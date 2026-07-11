const socket = io();

let myId = null;
let isHost = false;
let players = {};      // 클라이언트가 들고 있는 최신 플레이어 상태 사본 (렌더/순위 계산용)
let playerOrder = [];  // 토큰 고정 x 좌표 순서
let alreadyAnswered = false;
let localTimerInterval = null;
let localDeadline = null;
let localTimeLimit = 10;
let clientPaused = false;

// ---------- 화면 전환 ----------
const screens = {
  login: document.getElementById('screen-login'),
  waiting: document.getElementById('screen-waiting'),
  game: document.getElementById('screen-game'),
  result: document.getElementById('screen-result'),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  const chatBox = document.getElementById('chat-box');
  if (chatBox) chatBox.classList.toggle('hidden', name === 'login');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- 사운드 (Web Audio API) ----------
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtxClass();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, duration, type, volume, delay) {
  if (!audioCtx) return;
  delay = delay || 0;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + duration + 0.02);
}
function playCountdownBeep(n) {
  const freq = n === 1 ? 880 : (n === 2 ? 659 : 523);
  playTone(freq, 0.22, 'square', 0.3);
}
function playCorrectSound() {
  playTone(784.0, 0.14, 'sine', 0.28, 0);
  playTone(1046.5, 0.2, 'sine', 0.28, 0.11);
}
function playFallSound() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.35);
  gain.gain.setValueAtTime(0.25, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 0.42);
}
function playSplashSound() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.3);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 700;
  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start(t0);
}
function playBonusSound() {
  // 1등 정답 보너스: 반짝이는 3음 아르페지오
  playTone(880, 0.12, 'sine', 0.22, 0.02);
  playTone(1174.7, 0.12, 'sine', 0.22, 0.1);
  playTone(1568, 0.18, 'sine', 0.24, 0.18);
}

// ---------- 로그인 ----------
const nicknameInput = document.getElementById('nickname-input');
const btnJoin = document.getElementById('btn-join');
const loginError = document.getElementById('login-error');
const roomButtons = document.querySelectorAll('.room-btn');
let selectedRoom = 'typing';
let currentRoomLabel = '';
let quizTotal = null;

roomButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    roomButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRoom = btn.dataset.room;
  });
});

btnJoin.addEventListener('click', doJoin);
nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

function doJoin() {
  ensureAudio();
  const nickname = nicknameInput.value.trim();
  if (!nickname) { loginError.textContent = '닉네임을 입력해주세요.'; return; }
  loginError.textContent = '';
  socket.emit('join', { nickname, room: selectedRoom });
}

socket.on('errorMsg', ({ message }) => { loginError.textContent = message; });

// ---------- 대기실 ----------
const waitingGrid = document.getElementById('waiting-grid');
const waitingCount = document.getElementById('waiting-count');
const waitingRoomLabel = document.getElementById('waiting-room-label');
const btnStart = document.getElementById('btn-start');
const waitingHint = document.getElementById('waiting-hint');
const langSelect = document.getElementById('lang-select');
const langBtnEn = document.getElementById('lang-btn-en');
const langBtnKr = document.getElementById('lang-btn-kr');
let currentRoomMode = 'typing';
let currentWordLanguage = 'en';

socket.on('joined', ({ self, isHost: hostFlag, players: list, roomLabel, quizTotal: qt, mode, wordLanguage }) => {
  myId = self.id;
  isHost = hostFlag;
  currentRoomLabel = roomLabel || '';
  quizTotal = qt || null;
  currentRoomMode = mode || 'typing';
  currentWordLanguage = wordLanguage || 'en';
  cachePlayers(list);
  renderWaitingRoom();
  updateLangSelectUI();
  showScreen('waiting');
});

socket.on('wordLanguageUpdate', ({ wordLanguage }) => {
  currentWordLanguage = wordLanguage;
  updateLangSelectUI();
});

function updateLangSelectUI() {
  langSelect.classList.toggle('hidden', currentRoomMode !== 'typing');
  langBtnEn.classList.toggle('selected', currentWordLanguage === 'en');
  langBtnKr.classList.toggle('selected', currentWordLanguage === 'kr');
  langBtnEn.disabled = !isHost;
  langBtnKr.disabled = !isHost;
}
langBtnEn.addEventListener('click', () => { if (isHost) socket.emit('setWordLanguage', { lang: 'en' }); });
langBtnKr.addEventListener('click', () => { if (isHost) socket.emit('setWordLanguage', { lang: 'kr' }); });

socket.on('playerListUpdate', ({ players: list, hostId }) => {
  isHost = myId === hostId;
  cachePlayers(list);
  renderWaitingRoom();
  updateLangSelectUI();
});

socket.on('youAreHost', () => { isHost = true; updateHostControls(); updateLangSelectUI(); });

function cachePlayers(list) {
  players = {};
  list.forEach(p => { players[p.id] = p; });
}

function renderWaitingRoom() {
  const list = Object.values(players);
  waitingRoomLabel.textContent = currentRoomLabel;
  waitingCount.textContent = `(${list.length}/35)`;
  waitingGrid.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'waiting-card';
    card.innerHTML = `
      <div class="emoji">${p.animal.emoji}</div>
      <div class="name">${escapeHtml(p.nickname)}</div>
      ${p.isHost ? '<div class="host-badge">HOST</div>' : ''}
    `;
    waitingGrid.appendChild(card);
  });
  updateHostControls();
}
function updateHostControls() {
  if (isHost) { btnStart.classList.remove('hidden'); waitingHint.classList.add('hidden'); }
  else { btnStart.classList.add('hidden'); waitingHint.classList.remove('hidden'); }
}
btnStart.addEventListener('click', () => { ensureAudio(); socket.emit('startGame'); });

document.getElementById('btn-back-to-login').addEventListener('click', () => {
  socket.emit('leaveRoom');
  myId = null;
  isHost = false;
  players = {};
  currentRoomLabel = '';
  quizTotal = null;
  currentRoomMode = 'typing';
  currentWordLanguage = 'en';
  nicknameInput.value = '';
  loginError.textContent = '';
  showScreen('login');
});

// ---------- 게임 화면 ----------
const playersLayer = document.getElementById('players-layer');
const roundLabel = document.getElementById('round-label');
const aliveLabel = document.getElementById('alive-label');
const timerBar = document.getElementById('timer-bar');
const wordDisplay = document.getElementById('word-display');
const answerInput = document.getElementById('answer-input');
const answerFeedback = document.getElementById('answer-feedback');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumberEl = document.getElementById('countdown-number');

const STAGE_TOP_PAD = 0, STAGE_BOTTOM_PAD = 22, MAX_ROW = 10;

socket.on('gameStarted', ({ players: list }) => {
  cachePlayers(list);
  playerOrder = list.map(p => p.id);
  buildPlayerTokens();
  showScreen('game');
});

function buildPlayerTokens() {
  playersLayer.innerHTML = '';
  const n = playerOrder.length;
  playerOrder.forEach((id, idx) => {
    const p = players[id];
    if (!p) return;
    const token = document.createElement('div');
    token.className = 'player-token' + (id === myId ? ' me' : '');
    token.id = 'token-' + id;
    token.style.left = (((idx + 0.5) / n) * 100) + '%';
    token.style.top = rowToTopPercent(p.row) + '%';
    token.innerHTML = `<div class="emoji">${p.animal.emoji}</div><div class="name">${escapeHtml(p.nickname)}</div>`;
    playersLayer.appendChild(token);
  });
}
function rowToTopPercent(row) {
  const usable = 100 - STAGE_TOP_PAD - STAGE_BOTTOM_PAD;
  const pct = STAGE_TOP_PAD + (row / MAX_ROW) * usable;
  return Math.max(0, Math.min(100, pct)); // 화면 맨 위(0%)~물 위(100-여백) 범위로 클램프
}

function formatRoundLabel(round) {
  return quizTotal ? `문제 ${round}/${quizTotal}` : `라운드 ${round}`;
}

socket.on('countdownNumber', ({ n, round, aliveCount, quizTotal: qt }) => {
  if (qt) quizTotal = qt;
  alreadyAnswered = false;
  clearInterval(localTimerInterval);
  timerBar.style.width = '0%';
  wordDisplay.textContent = '';
  answerFeedback.textContent = ''; answerFeedback.className = '';
  answerInput.value = ''; answerInput.disabled = true;
  if (round) roundLabel.textContent = formatRoundLabel(round);
  if (aliveCount) aliveLabel.textContent = `생존 ${aliveCount}명`;

  countdownOverlay.classList.remove('hidden');
  countdownNumberEl.textContent = n;
  countdownNumberEl.classList.remove('pop');
  void countdownNumberEl.offsetWidth;
  countdownNumberEl.classList.add('pop');
  playCountdownBeep(n);
});

socket.on('questionStart', ({ round, questionText, timeLimit, aliveCount, quizTotal: qt }) => {
  if (qt) quizTotal = qt;
  countdownOverlay.classList.add('hidden');
  roundLabel.textContent = formatRoundLabel(round);
  aliveLabel.textContent = `생존 ${aliveCount}명`;
  wordDisplay.textContent = questionText;
  wordDisplay.classList.toggle('quiz-mode', !!quizTotal);
  answerFeedback.textContent = ''; answerFeedback.className = '';
  answerInput.value = '';
  alreadyAnswered = false;

  const me = players[myId];
  if (me && me.eliminated) {
    answerInput.disabled = true;
    answerInput.placeholder = '탈락하여 관전 중입니다';
  } else {
    answerInput.disabled = false;
    answerInput.placeholder = '여기에 정답을 입력하세요';
    answerInput.focus();
  }

  localTimeLimit = timeLimit;
  localDeadline = Date.now() + timeLimit * 1000;
  startLocalTimerBar();
});

function startLocalTimerBar() {
  clearInterval(localTimerInterval);
  timerBar.style.background = '#ffb347';
  const tick = () => {
    if (clientPaused) return;
    const remain = Math.max(0, localDeadline - Date.now());
    const pct = Math.max(0, (remain / (localTimeLimit * 1000)) * 100);
    timerBar.style.width = pct + '%';
    if (pct < 30) timerBar.style.background = '#ff6b6b';
    if (remain <= 0) clearInterval(localTimerInterval);
  };
  tick();
  localTimerInterval = setInterval(tick, 100);
}

answerInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); });
function submitAnswer() {
  if (alreadyAnswered || answerInput.disabled) return;
  const text = answerInput.value;
  if (!text) return;
  alreadyAnswered = true;
  answerInput.disabled = true;
  socket.emit('submitAnswer', { text });
  answerFeedback.textContent = '제출 완료! 결과를 기다리는 중...';
}

// 서버가 정답 여부를 확정하는 즉시 반영 (본인/타인 공통 애니메이션, 소리는 본인만)
socket.on('answerResult', ({ id, correct, row, wrongCount, eliminated, firstBonus, correctAnswer }) => {
  const p = players[id];
  if (p) { p.row = row; p.wrongCount = wrongCount; p.eliminated = eliminated; }

  const token = document.getElementById('token-' + id);
  if (token) {
    token.style.top = rowToTopPercent(row) + '%';
    token.classList.remove('wrong-flash', 'correct-flash', 'first-bonus');
    void token.offsetWidth;
    token.classList.add(correct ? 'correct-flash' : 'wrong-flash');
    if (firstBonus) token.classList.add('first-bonus');
    if (eliminated) setTimeout(() => token.classList.add('eliminated'), 250);
  }

  if (id === myId) {
    if (correct && firstBonus) {
      answerFeedback.textContent = '⚡ 1등 정답! 1.2칸 이동!';
      answerFeedback.className = 'correct';
      playCorrectSound();
      playBonusSound();
    } else if (correct) {
      answerFeedback.textContent = '정답입니다! 🎉 (위로 한 칸 이동)';
      answerFeedback.className = 'correct';
      playCorrectSound();
    } else {
      answerFeedback.textContent = `오답! 정답은 "${correctAnswer}" 였습니다. (아래로 한 칸 이동)`;
      answerFeedback.className = 'wrong';
      playFallSound();
      if (eliminated) setTimeout(playSplashSound, 300);
    }
  }
});

// ---------- 결과 ----------
const winnerAnimal = document.getElementById('winner-animal');
const winnerName = document.getElementById('winner-name');
const btnRestart = document.getElementById('btn-restart');
const restartHint = document.getElementById('restart-hint');
const resultRankingList = document.getElementById('result-ranking-list');

socket.on('gameOver', ({ winner, ranking }) => {
  clearInterval(localTimerInterval);
  if (winner) { winnerAnimal.textContent = winner.animal.emoji; winnerName.textContent = winner.nickname; }
  else { winnerAnimal.textContent = '🤝'; winnerName.textContent = '무승부 (생존자 없음)'; }

  renderRankingInto(resultRankingList, ranking);

  if (isHost) { btnRestart.classList.remove('hidden'); btnRestart.disabled = false; restartHint.classList.add('hidden'); }
  else { btnRestart.classList.add('hidden'); restartHint.classList.remove('hidden'); }
  showScreen('result');
});
btnRestart.addEventListener('click', () => socket.emit('restartGame'));

socket.on('gameReset', ({ players: list, hostId }) => {
  isHost = myId === hostId;
  cachePlayers(list);
  renderWaitingRoom();
  document.getElementById('pause-overlay').classList.add('hidden');
  clientPaused = false;
  showScreen('waiting');
});

// ---------- 순위 (게임 멈추지 않는 개인 열람) ----------
function renderRankingInto(container, ranking) {
  container.innerHTML = '';
  ranking.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'ranking-row' + (p.id === myId ? ' me' : '') + (idx === 0 ? ' rank-1' : '');
    const status = p.eliminated ? '탈락' : '생존 중';
    row.innerHTML = `
      <span class="rank-num">${idx + 1}</span>
      <span class="rank-emoji">${p.animal.emoji}</span>
      <span class="rank-name">${escapeHtml(p.nickname)}</span>
      <span class="rank-status">${status}</span>
    `;
    container.appendChild(row);
  });
}

const rankingOverlay = document.getElementById('ranking-overlay');
document.getElementById('btn-ranking-toggle').addEventListener('click', () => {
  socket.emit('requestRanking');
});
socket.on('rankingData', ({ ranking }) => {
  renderRankingInto(document.getElementById('ranking-list'), ranking);
  rankingOverlay.classList.remove('hidden');
});
document.getElementById('btn-ranking-close').addEventListener('click', () => {
  rankingOverlay.classList.add('hidden');
});

// ---------- 호스트 전용 일시정지 ----------
const pauseOverlay = document.getElementById('pause-overlay');
const pauseTitle = document.getElementById('pause-title');
const btnResume = document.getElementById('btn-resume');
const btnRestartMid = document.getElementById('btn-restart-mid');
const pauseNonHostHint = document.getElementById('pause-nonhost-hint');

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!screens.game.classList.contains('active')) return;
  e.preventDefault();
  if (!isHost) return; // 일시정지는 호스트 전용
  if (clientPaused) socket.emit('resumeGame');
  else socket.emit('pauseGame');
});

socket.on('gamePaused', () => {
  clientPaused = true;
  pauseTitle.textContent = '⏸️ 일시정지';
  if (isHost) {
    btnResume.classList.remove('hidden');
    btnRestartMid.classList.remove('hidden');
    pauseNonHostHint.classList.add('hidden');
  } else {
    btnResume.classList.add('hidden');
    btnRestartMid.classList.add('hidden');
    pauseNonHostHint.classList.remove('hidden');
  }
  pauseOverlay.classList.remove('hidden');
});

socket.on('gameResumed', ({ phase, timeRemainingMs, countdownNumber }) => {
  clientPaused = false;
  pauseOverlay.classList.add('hidden');
  if (phase === 'question' && typeof timeRemainingMs === 'number') {
    localDeadline = Date.now() + timeRemainingMs;
    startLocalTimerBar();
  } else if (phase === 'countdown' && countdownNumber) {
    countdownOverlay.classList.remove('hidden');
    countdownNumberEl.textContent = countdownNumber;
  }
});

btnResume.addEventListener('click', () => socket.emit('resumeGame'));
btnRestartMid.addEventListener('click', () => socket.emit('restartMidGame'));

// ---------- 작은 채팅창 (우측 하단) ----------
const chatBox = document.getElementById('chat-box');
const chatHeader = document.querySelector('.chat-header');
const chatToggleBtn = document.getElementById('chat-toggle');
const chatMessagesEl = document.getElementById('chat-messages');
const chatInputRow = document.querySelector('.chat-input-row');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');

let chatCollapsed = false;
function setChatCollapsed(collapsed) {
  chatCollapsed = collapsed;
  chatMessagesEl.classList.toggle('collapsed', collapsed);
  chatInputRow.classList.toggle('collapsed', collapsed);
  chatToggleBtn.textContent = collapsed ? '＋' : '－';
}
chatHeader.addEventListener('click', (e) => {
  if (e.target === chatToggleBtn) return; // 버튼 클릭은 아래에서 별도 처리
  setChatCollapsed(!chatCollapsed);
});
chatToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setChatCollapsed(!chatCollapsed);
});

function appendChatMessage(nickname, text, isMine) {
  const row = document.createElement('div');
  row.className = 'chat-msg' + (isMine ? ' me' : '');
  row.innerHTML = `<span class="chat-name">${escapeHtml(nickname)}</span><span>${escapeHtml(text)}</span>`;
  chatMessagesEl.appendChild(row);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('chatMessage', { text });
  chatInput.value = '';
}
chatSendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation(); // 채팅 입력 중 Enter가 정답 제출로 새지 않도록
  if (e.key === 'Enter') sendChat();
});

socket.on('chatMessage', ({ nickname, text, id }) => {
  appendChatMessage(nickname, text, id === myId);
});
