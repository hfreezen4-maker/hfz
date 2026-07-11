const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { ANIMALS } = require('./animals');
const { WORDS } = require('./words');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ------------------ 게임 설정값 ------------------
const MAX_PLAYERS = 35;
const START_ROW = 2;          // 시작 위치: 맨 위에서 2칸 아래
const MAX_ROW = 10;           // 물(최하단) 위치
const NEXT_ROUND_DELAY = 1800; // 결과 유지 시간(ms)
const COUNTDOWN_STEP_MS = 700; // 3,2,1 각 숫자 유지 시간

function getRoundTime(round) {
  if (round <= 10) return 10;
  if (round <= 20) return 7;
  if (round <= 26) return 5;
  if (round <= 31) return 4;
  if (round <= 36) return 3;
  if (round <= 41) return 2;
  return 1;
}

// ------------------ 게임 상태 ------------------
let players = {};        // socket.id -> player
let hostId = null;
let usedAnimalIds = new Set();
let eliminationCounter = 0;

// gameState: 'waiting' | 'countdown' | 'question' | 'result' | 'ended'
let gameState = 'waiting';
let currentRound = 0;
let currentWord = null;
let currentRoundTime = 10;
let roundAnswered = {}; // socket.id -> true (이번 라운드에 이미 처리됨)
let countdownStep = 3;
let countdownStepStart = 0;
let currentDeadline = 0;
let resultEndTime = 0;
let mainLoopId = null;

// 일시정지 (호스트 전용) - 가상 시계
let isPaused = false;
let pauseOffset = 0;
let pauseStartTime = null;

function vNow() {
  return isPaused ? (pauseStartTime - pauseOffset) : (Date.now() - pauseOffset);
}

function assignAnimal() {
  const available = ANIMALS.filter(a => !usedAnimalIds.has(a.id));
  if (available.length === 0) return null;
  const animal = available[Math.floor(Math.random() * available.length)];
  usedAnimalIds.add(animal.id);
  return animal;
}

function publicPlayer(p) {
  return {
    id: p.id, nickname: p.nickname, animal: p.animal,
    row: p.row, wrongCount: p.wrongCount, eliminated: p.eliminated,
    isHost: p.id === hostId,
  };
}
function publicPlayerList() { return Object.values(players).map(publicPlayer); }
function activePlayers() { return Object.values(players).filter(p => !p.eliminated); }

function computeRanking() {
  return Object.values(players).map(publicPlayer).sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (!a.eliminated) {
      if (a.row !== b.row) return a.row - b.row;
      return a.wrongCount - b.wrongCount;
    }
    return (players[b.id].eliminatedAt || 0) - (players[a.id].eliminatedAt || 0);
  });
}

io.on('connection', (socket) => {
  socket.on('join', ({ nickname }) => {
    if (gameState !== 'waiting') {
      socket.emit('errorMsg', { message: '이미 게임이 진행 중입니다. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    if (Object.keys(players).length >= MAX_PLAYERS) {
      socket.emit('errorMsg', { message: '대기실 인원이 가득 찼습니다. (최대 35명)' });
      return;
    }
    const clean = (nickname || '').toString().trim().slice(0, 10) || `player${Math.floor(Math.random() * 1000)}`;
    const animal = assignAnimal();
    if (!animal) { socket.emit('errorMsg', { message: '캐릭터를 더 이상 배정할 수 없습니다.' }); return; }
    const isFirst = Object.keys(players).length === 0;
    if (isFirst) hostId = socket.id;

    players[socket.id] = {
      id: socket.id, nickname: clean, animal,
      row: START_ROW, wrongCount: 0, eliminated: false, eliminatedAt: null,
    };

    socket.emit('joined', { self: publicPlayer(players[socket.id]), isHost: socket.id === hostId, players: publicPlayerList() });
    socket.broadcast.emit('playerListUpdate', { players: publicPlayerList(), hostId });
  });

  socket.on('startGame', () => {
    if (socket.id !== hostId || gameState !== 'waiting') return;
    if (Object.keys(players).length < 2) {
      socket.emit('errorMsg', { message: '최소 2명 이상 모여야 시작할 수 있습니다.' });
      return;
    }
    startGame();
  });

  socket.on('submitAnswer', ({ text }) => {
    if (gameState !== 'question') return;
    const p = players[socket.id];
    if (!p || p.eliminated || roundAnswered[socket.id]) return;
    roundAnswered[socket.id] = true;
    const correct = (text || '').toString().trim().toLowerCase() === (currentWord || '').toLowerCase();
    applyAnswer(p, correct);
    maybeFinishEarly();
  });

  // 호스트 전용: 일시정지 / 재개 / 중간 재시작
  socket.on('pauseGame', () => {
    if (socket.id !== hostId) return;
    if (isPaused || gameState === 'waiting' || gameState === 'ended') return;
    isPaused = true;
    pauseStartTime = Date.now();
    io.emit('gamePaused');
  });
  socket.on('resumeGame', () => {
    if (socket.id !== hostId || !isPaused) return;
    pauseOffset += Date.now() - pauseStartTime;
    isPaused = false;
    const payload = { phase: gameState };
    if (gameState === 'question') payload.timeRemainingMs = Math.max(0, currentDeadline - vNow());
    if (gameState === 'countdown') payload.countdownNumber = countdownStep;
    io.emit('gameResumed', payload);
  });
  socket.on('restartMidGame', () => {
    if (socket.id !== hostId) return;
    resetToWaiting();
  });

  // 아무나: 현재 순위 스냅샷 요청 (게임에 영향 없음)
  socket.on('requestRanking', () => {
    socket.emit('rankingData', { ranking: computeRanking() });
  });

  socket.on('restartGame', () => { // 결과 화면에서 "다시 시작" (호스트 전용)
    if (socket.id !== hostId || gameState !== 'ended') return;
    resetToWaiting();
  });

  socket.on('disconnect', () => {
    const wasHost = socket.id === hostId;
    const existed = players[socket.id];
    if (existed) { usedAnimalIds.delete(existed.animal.id); delete players[socket.id]; }
    delete roundAnswered[socket.id];

    if (wasHost) {
      const remaining = Object.keys(players);
      hostId = remaining.length ? remaining[0] : null;
      if (hostId) io.to(hostId).emit('youAreHost');
    }
    io.emit('playerListUpdate', { players: publicPlayerList(), hostId });

    if (gameState === 'question' || gameState === 'countdown') {
      const active = activePlayers();
      if (active.length <= 1) { clearInterval(mainLoopId); endGame(active[0] || null); }
      else maybeFinishEarly();
    }
  });
});

function applyAnswer(p, correct) {
  if (correct) {
    p.row = Math.max(0, p.row - 1);
  } else {
    p.wrongCount++;
    p.row = Math.min(p.row + 1, MAX_ROW);
    if (p.row >= MAX_ROW && !p.eliminated) {
      p.eliminated = true;
      p.eliminatedAt = ++eliminationCounter;
    }
  }
  io.emit('answerResult', { id: p.id, correct, row: p.row, wrongCount: p.wrongCount, eliminated: p.eliminated });
}

function maybeFinishEarly() {
  if (gameState !== 'question') return;
  const waiting = activePlayers().filter(p => !roundAnswered[p.id]);
  if (waiting.length === 0) finishRound();
}

function startGame() {
  gameState = 'waiting';
  currentRound = 0;
  eliminationCounter = 0;
  Object.values(players).forEach(p => { p.row = START_ROW; p.wrongCount = 0; p.eliminated = false; p.eliminatedAt = null; });
  io.emit('gameStarted', { players: publicPlayerList() });
  clearInterval(mainLoopId);
  mainLoopId = setInterval(tick, 120);
  beginRound();
}

function beginRound() {
  const active = activePlayers();
  if (active.length <= 1) { endGame(active[0] || null); return; }
  currentRound++;
  roundAnswered = {};
  gameState = 'countdown';
  countdownStep = 3;
  countdownStepStart = vNow();
  io.emit('countdownNumber', { n: 3, round: currentRound, aliveCount: active.length });
}

function startQuestionPhase() {
  gameState = 'question';
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentRoundTime = getRoundTime(currentRound);
  currentDeadline = vNow() + currentRoundTime * 1000;
  io.emit('questionStart', { round: currentRound, word: currentWord, timeLimit: currentRoundTime, aliveCount: activePlayers().length });
}

function finishRound() {
  if (gameState !== 'question') return;
  gameState = 'result';
  // 시간 초과로 답 못한 사람은 오답 처리
  activePlayers().forEach(p => {
    if (roundAnswered[p.id]) return;
    roundAnswered[p.id] = true;
    applyAnswer(p, false);
  });
  resultEndTime = vNow() + NEXT_ROUND_DELAY;
}

function endGame(winner) {
  gameState = 'ended';
  clearInterval(mainLoopId);
  isPaused = false; pauseOffset = 0; pauseStartTime = null;
  io.emit('gameOver', {
    winner: winner ? { id: winner.id, nickname: winner.nickname, animal: winner.animal } : null,
    ranking: computeRanking(),
  });
}

function resetToWaiting() {
  gameState = 'waiting';
  clearInterval(mainLoopId);
  isPaused = false; pauseOffset = 0; pauseStartTime = null;
  eliminationCounter = 0;
  currentRound = 0;
  Object.values(players).forEach(p => { p.row = START_ROW; p.wrongCount = 0; p.eliminated = false; p.eliminatedAt = null; });
  io.emit('gameReset', { players: publicPlayerList(), hostId });
}

function tick() {
  if (isPaused) return;

  if (gameState === 'countdown') {
    const elapsed = vNow() - countdownStepStart;
    if (elapsed >= COUNTDOWN_STEP_MS) {
      countdownStep--;
      if (countdownStep >= 1) {
        countdownStepStart = vNow();
        io.emit('countdownNumber', { n: countdownStep });
      } else {
        startQuestionPhase();
      }
    }
  } else if (gameState === 'question') {
    if (vNow() >= currentDeadline) finishRound();
  } else if (gameState === 'result') {
    if (vNow() >= resultEndTime) {
      const active = activePlayers();
      if (active.length <= 1) endGame(active[0] || null);
      else beginRound();
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('==========================================');
  console.log(' 타자 서바이벌 서버 실행 중');
  console.log(` 로컬 접속: http://localhost:${PORT}`);
  console.log('==========================================');
});
