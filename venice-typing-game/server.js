const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { ANIMALS } = require('./animals');
const { WORDS } = require('./words');
const { QUIZ_QUESTIONS } = require('./quiz-questions');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ------------------ 공통 게임 설정값 ------------------
const MAX_PLAYERS = 35;
const START_ROW = 3;           // 시작 위치: 맨 위에서 3칸 아래
const MAX_ROW = 10;            // 물(최하단) 위치
const NEXT_ROUND_DELAY = 1800; // 결과 유지 시간(ms)
const COUNTDOWN_STEP_MS = 700; // 3,2,1 각 숫자 유지 시간

// 라운드별 제한시간(초) - 5초부터 시작해서 점점 줄어듭니다
function getRoundTime(round) {
  if (round <= 10) return 5;
  if (round <= 20) return 4;
  if (round <= 26) return 3;
  if (round <= 31) return 2;
  return 1;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------ 방(room) 하나를 만드는 팩토리 ------------------
// mode: 'typing' (기존 영어 타자) | 'quiz' (정보 퀴즈, 20문제 고정)
function createRoom(roomId, mode, label) {
  const state = {
    roomId, mode, label,
    players: {},
    hostId: null,
    usedAnimalIds: new Set(),
    eliminationCounter: 0,
    gameState: 'waiting', // waiting | countdown | question | result | ended
    currentRound: 0,
    currentWord: null,     // typing: 정답 단어 / quiz: 정답
    currentQuestionText: null, // quiz: 화면에 보여줄 문제 (typing에서는 currentWord와 동일)
    currentRoundTime: 5,
    roundAnswered: {},
    firstCorrectAwarded: false, // 이번 라운드 "1등 정답" 보너스가 이미 지급됐는지
    countdownStep: 3,
    countdownStepStart: 0,
    currentDeadline: 0,
    resultEndTime: 0,
    mainLoopId: null,
    isPaused: false,
    pauseOffset: 0,
    pauseStartTime: null,
    quizOrder: [],   // quiz 모드에서 문제 순서(셔플됨)
    quizTotal: mode === 'quiz' ? QUIZ_QUESTIONS.length : null,
  };

  function vNow() {
    return state.isPaused ? (state.pauseStartTime - state.pauseOffset) : (Date.now() - state.pauseOffset);
  }

  function assignAnimal() {
    const available = ANIMALS.filter(a => !state.usedAnimalIds.has(a.id));
    if (available.length === 0) return null;
    const animal = available[Math.floor(Math.random() * available.length)];
    state.usedAnimalIds.add(animal.id);
    return animal;
  }

  function publicPlayer(p) {
    return {
      id: p.id, nickname: p.nickname, animal: p.animal,
      row: p.row, wrongCount: p.wrongCount, eliminated: p.eliminated,
      isHost: p.id === state.hostId,
    };
  }
  function publicPlayerList() { return Object.values(state.players).map(publicPlayer); }
  function activePlayers() { return Object.values(state.players).filter(p => !p.eliminated); }

  function computeRanking() {
    return Object.values(state.players).map(publicPlayer).sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (!a.eliminated) {
        if (a.row !== b.row) return a.row - b.row;
        return a.wrongCount - b.wrongCount;
      }
      return (state.players[b.id].eliminatedAt || 0) - (state.players[a.id].eliminatedAt || 0);
    });
  }

  function emitRoom(event, payload) { io.to(roomId).emit(event, payload); }

  function join(socket, nickname) {
    if (state.gameState !== 'waiting') {
      socket.emit('errorMsg', { message: '이미 게임이 진행 중입니다. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    if (Object.keys(state.players).length >= MAX_PLAYERS) {
      socket.emit('errorMsg', { message: '대기실 인원이 가득 찼습니다. (최대 35명)' });
      return;
    }
    const clean = (nickname || '').toString().trim().slice(0, 10) || `player${Math.floor(Math.random() * 1000)}`;
    const animal = assignAnimal();
    if (!animal) { socket.emit('errorMsg', { message: '캐릭터를 더 이상 배정할 수 없습니다.' }); return; }
    const isFirst = Object.keys(state.players).length === 0;
    if (isFirst) state.hostId = socket.id;

    socket.join(roomId);
    socket.data.roomId = roomId;

    state.players[socket.id] = {
      id: socket.id, nickname: clean, animal,
      row: START_ROW, wrongCount: 0, eliminated: false, eliminatedAt: null,
    };

    socket.emit('joined', {
      self: publicPlayer(state.players[socket.id]),
      isHost: socket.id === state.hostId,
      players: publicPlayerList(),
      roomLabel: state.label,
      quizTotal: state.quizTotal,
    });
    socket.to(roomId).emit('playerListUpdate', { players: publicPlayerList(), hostId: state.hostId });
  }

  function startGame(socket) {
    if (socket.id !== state.hostId || state.gameState !== 'waiting') return;
    if (Object.keys(state.players).length < 2) {
      socket.emit('errorMsg', { message: '최소 2명 이상 모여야 시작할 수 있습니다.' });
      return;
    }
    state.currentRound = 0;
    state.eliminationCounter = 0;
    Object.values(state.players).forEach(p => { p.row = START_ROW; p.wrongCount = 0; p.eliminated = false; p.eliminatedAt = null; });
    if (state.mode === 'quiz') state.quizOrder = shuffle(QUIZ_QUESTIONS.map((_, i) => i));
    emitRoom('gameStarted', { players: publicPlayerList() });
    clearInterval(state.mainLoopId);
    state.mainLoopId = setInterval(tick, 120);
    beginRound();
  }

  function beginRound() {
    const active = activePlayers();
    if (active.length <= 1) { endGame(active[0] || null); return; }
    // 퀴즈 모드는 20문제(또는 준비된 문제 수)를 다 쓰면 그 시점 순위로 종료
    if (state.mode === 'quiz' && state.currentRound >= state.quizTotal) {
      endGame(computeRanking()[0] ? state.players[computeRanking()[0].id] : null);
      return;
    }
    state.currentRound++;
    state.roundAnswered = {};
    state.gameState = 'countdown';
    state.countdownStep = 3;
    state.countdownStepStart = vNow();
    emitRoom('countdownNumber', { n: 3, round: state.currentRound, aliveCount: active.length, quizTotal: state.quizTotal });
  }

  function startQuestionPhase() {
    state.gameState = 'question';
    if (state.mode === 'quiz') {
      const qIdx = state.quizOrder[(state.currentRound - 1) % state.quizOrder.length];
      const q = QUIZ_QUESTIONS[qIdx];
      state.currentWord = q.answer;
      state.currentQuestionText = q.question;
    } else {
      state.currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      state.currentQuestionText = state.currentWord;
    }
    state.currentRoundTime = getRoundTime(state.currentRound);
    state.currentDeadline = vNow() + state.currentRoundTime * 1000;
    state.firstCorrectAwarded = false;
    emitRoom('questionStart', {
      round: state.currentRound,
      questionText: state.currentQuestionText,
      timeLimit: state.currentRoundTime,
      aliveCount: activePlayers().length,
      quizTotal: state.quizTotal,
    });
  }

  function applyAnswer(p, correct) {
    let firstBonus = false;
    if (correct) {
      if (!state.firstCorrectAwarded) {
        state.firstCorrectAwarded = true;
        firstBonus = true;
        p.row = Math.max(0, p.row - 1.5); // 1등 정답 보너스: 1.5칸 이동
      } else {
        p.row = Math.max(0, p.row - 1);
      }
    } else {
      p.wrongCount++;
      p.row = Math.min(p.row + 1, MAX_ROW);
      if (p.row >= MAX_ROW && !p.eliminated) {
        p.eliminated = true;
        p.eliminatedAt = ++state.eliminationCounter;
      }
    }
    emitRoom('answerResult', {
      id: p.id, correct, row: p.row, wrongCount: p.wrongCount, eliminated: p.eliminated, firstBonus,
      correctAnswer: state.currentWord,
    });
  }

  function submitAnswer(socket, text) {
    if (state.gameState !== 'question') return;
    const p = state.players[socket.id];
    if (!p || p.eliminated || state.roundAnswered[socket.id]) return;
    state.roundAnswered[socket.id] = true;
    const correct = (text || '').toString().trim().toLowerCase() === (state.currentWord || '').toLowerCase();
    applyAnswer(p, correct);
    maybeFinishEarly();
  }

  function maybeFinishEarly() {
    if (state.gameState !== 'question') return;
    const waiting = activePlayers().filter(p => !state.roundAnswered[p.id]);
    if (waiting.length === 0) finishRound();
  }

  function finishRound() {
    if (state.gameState !== 'question') return;
    state.gameState = 'result';
    activePlayers().forEach(p => {
      if (state.roundAnswered[p.id]) return;
      state.roundAnswered[p.id] = true;
      applyAnswer(p, false);
    });
    state.resultEndTime = vNow() + NEXT_ROUND_DELAY;
  }

  function endGame(winner) {
    state.gameState = 'ended';
    clearInterval(state.mainLoopId);
    state.isPaused = false; state.pauseOffset = 0; state.pauseStartTime = null;
    emitRoom('gameOver', {
      winner: winner ? { id: winner.id, nickname: winner.nickname, animal: winner.animal } : null,
      ranking: computeRanking(),
    });
  }

  function resetToWaiting() {
    state.gameState = 'waiting';
    clearInterval(state.mainLoopId);
    state.isPaused = false; state.pauseOffset = 0; state.pauseStartTime = null;
    state.eliminationCounter = 0;
    state.currentRound = 0;
    Object.values(state.players).forEach(p => { p.row = START_ROW; p.wrongCount = 0; p.eliminated = false; p.eliminatedAt = null; });
    emitRoom('gameReset', { players: publicPlayerList(), hostId: state.hostId });
  }

  function pauseGame(socket) {
    if (socket.id !== state.hostId) return;
    if (state.isPaused || state.gameState === 'waiting' || state.gameState === 'ended') return;
    state.isPaused = true;
    state.pauseStartTime = Date.now();
    emitRoom('gamePaused');
  }
  function resumeGame(socket) {
    if (socket.id !== state.hostId || !state.isPaused) return;
    state.pauseOffset += Date.now() - state.pauseStartTime;
    state.isPaused = false;
    const payload = { phase: state.gameState };
    if (state.gameState === 'question') payload.timeRemainingMs = Math.max(0, state.currentDeadline - vNow());
    if (state.gameState === 'countdown') payload.countdownNumber = state.countdownStep;
    emitRoom('gameResumed', payload);
  }
  function restartMidGame(socket) {
    if (socket.id !== state.hostId) return;
    resetToWaiting();
  }
  function restartGame(socket) {
    if (socket.id !== state.hostId || state.gameState !== 'ended') return;
    resetToWaiting();
  }

  function requestRanking(socket) {
    socket.emit('rankingData', { ranking: computeRanking() });
  }

  function chatMessage(socket, text) {
    const p = state.players[socket.id];
    if (!p) return;
    const clean = (text || '').toString().trim().slice(0, 120);
    if (!clean) return;
    emitRoom('chatMessage', { nickname: p.nickname, text: clean, id: socket.id });
  }

  function handleDisconnect(socket) {
    const wasHost = socket.id === state.hostId;
    const existed = state.players[socket.id];
    if (existed) { state.usedAnimalIds.delete(existed.animal.id); delete state.players[socket.id]; }
    delete state.roundAnswered[socket.id];

    if (wasHost) {
      const remaining = Object.keys(state.players);
      state.hostId = remaining.length ? remaining[0] : null;
      if (state.hostId) io.to(state.hostId).emit('youAreHost');
    }
    emitRoom('playerListUpdate', { players: publicPlayerList(), hostId: state.hostId });

    if (state.gameState === 'question' || state.gameState === 'countdown') {
      const active = activePlayers();
      if (active.length <= 1) { clearInterval(state.mainLoopId); endGame(active[0] || null); }
      else maybeFinishEarly();
    }
  }

  function tick() {
    if (state.isPaused) return;
    if (state.gameState === 'countdown') {
      const elapsed = vNow() - state.countdownStepStart;
      if (elapsed >= COUNTDOWN_STEP_MS) {
        state.countdownStep--;
        if (state.countdownStep >= 1) {
          state.countdownStepStart = vNow();
          emitRoom('countdownNumber', { n: state.countdownStep });
        } else {
          startQuestionPhase();
        }
      }
    } else if (state.gameState === 'question') {
      if (vNow() >= state.currentDeadline) finishRound();
    } else if (state.gameState === 'result') {
      if (vNow() >= state.resultEndTime) {
        const active = activePlayers();
        if (active.length <= 1) endGame(active[0] || null);
        else beginRound();
      }
    }
  }

  return { state, join, startGame, submitAnswer, pauseGame, resumeGame, restartMidGame, restartGame, requestRanking, chatMessage, handleDisconnect };
}

const rooms = {
  typing: createRoom('typing', 'typing', '⌨️ 타자연습'),
  quiz: createRoom('quiz', 'quiz', '🧠 정보 퀴즈'),
};

function getRoom(roomId) { return rooms[roomId] || rooms.typing; }

io.on('connection', (socket) => {
  socket.on('join', ({ nickname, room }) => {
    getRoom(room).join(socket, nickname);
  });
  socket.on('startGame', () => { if (socket.data.roomId) getRoom(socket.data.roomId).startGame(socket); });
  socket.on('submitAnswer', ({ text }) => { if (socket.data.roomId) getRoom(socket.data.roomId).submitAnswer(socket, text); });
  socket.on('pauseGame', () => { if (socket.data.roomId) getRoom(socket.data.roomId).pauseGame(socket); });
  socket.on('resumeGame', () => { if (socket.data.roomId) getRoom(socket.data.roomId).resumeGame(socket); });
  socket.on('restartMidGame', () => { if (socket.data.roomId) getRoom(socket.data.roomId).restartMidGame(socket); });
  socket.on('restartGame', () => { if (socket.data.roomId) getRoom(socket.data.roomId).restartGame(socket); });
  socket.on('requestRanking', () => { if (socket.data.roomId) getRoom(socket.data.roomId).requestRanking(socket); });
  socket.on('chatMessage', ({ text }) => { if (socket.data.roomId) getRoom(socket.data.roomId).chatMessage(socket, text); });
  socket.on('disconnect', () => { if (socket.data.roomId) getRoom(socket.data.roomId).handleDisconnect(socket); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('==========================================');
  console.log(' 타자 서바이벌 서버 실행 중 (방: 타자연습 / 정보퀴즈)');
  console.log(` 로컬 접속: http://localhost:${PORT}`);
  console.log('==========================================');
});
