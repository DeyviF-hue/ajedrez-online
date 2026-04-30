import { io } from 'socket.io-client';
import { 
    BS, CS, PLAYERS, PIECE_VALUES, 
    isValid3, getLegalMoves3, isInCheck3, applyMoveSim3, undoMoveSim3, needsPromotion3, buildInitialBoard3 
} from '../logic/gameLogic3.js';

const PLAYER_NAMES = { w: 'Blancas', b: 'Negras', r: 'Rojas', g: 'Verdes' };
const PIECE_ICONS = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
const CAPTURE_PTS3  = { p:1, n:3, b:3, r:5, q:9 };

// --- Game State ---
let board3 = [];
let turnIndex = 0;
let eliminated = [];
let selectedSq = null;
let legalMoves3 = [];
let lastMove3 = null;
let isOver3 = false;
let isPaused3 = false;
let pendingPromo3 = null;
let moveHistory3 = [];
let activePlayers = ['w','b','r'];
let cfg3 = { w:'human', b:'ai', r:'ai', g:'ai' };
let scores3 = { w:0, b:0, r:0, g:0 };

let timeLeft3 = 600;
let totalTime3 = 600;
let timer3 = null;
let audioCtx3 = null;

// Variables Online
let socket = null;
let isOnline3 = false;
let myColor3 = null;
let currentRoomId3 = null;

// Modals
let bsConfigModal, bsRulesModal, bsGameOverModal, bsPromoModal;

// DOM
const boardEl3    = document.getElementById('chessboard3');
const statusEl3   = document.getElementById('status-display3');
const timerEl3    = document.getElementById('global-timer3');
const historyEl3  = document.getElementById('move-history3');

function connectSocket3() {
    if (socket) return;
    socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/');

    socket.on('gameStart3', (data) => {
        board3 = data.board;
        turnIndex = activePlayers.indexOf(data.currentTurn);
        Object.assign(cfg3, data.players); // w: socket.id, b: 'ai' etc.
        renderBoard3();
        renderStatus3();
        startTimer3();
    });

    socket.on('playerJoined3', (data) => {
        Object.assign(cfg3, data.players);
        renderStatus3();
    });

    socket.on('opponentMove3', (data) => {
        const { from, to, promoType } = data;
        executeLocalMove3(from, to, promoType);
    });

    socket.on('nextTurn3', (data) => {
        turnIndex = activePlayers.indexOf(data.currentTurn);
        eliminated = data.eliminated || eliminated;
        renderBoard3();
        renderStatus3();
    });

    socket.on('gameOver3', (data) => {
        endGame3(data.winner);
    });
}

function currentColor3() { return activePlayers[turnIndex]; }

function executeLocalMove3(from, to, promoType = 'q') {
    const piece = board3[from.r][from.c];
    const target = board3[to.r][to.c];
    const isCapture = target !== null;

    board3[to.r][to.c] = piece;
    board3[from.r][from.c] = null;

    if (isCapture && target[1] !== 'k') {
        scores3[piece[0]] = (scores3[piece[0]] || 0) + (CAPTURE_PTS3[target[1]] || 0);
    }

    let promoNotation = '';
    if (needsPromotion3(piece, to.r, to.c)) {
        board3[to.r][to.c] = piece[0] + promoType;
        promoNotation = '=' + promoType.toUpperCase();
    }

    const files = 'abcdefghijklmn';
    const notation = `${piece[1] !== 'p' ? piece[1].toUpperCase() : ''}${isCapture ? 'x' : ''}${files[to.c]}${14 - to.r}${promoNotation}`;
    moveHistory3.push({ color: piece[0], notation, hash: JSON.stringify(board3) });

    lastMove3 = { from, to };

    if (isCapture && target[1] === 'k') {
        eliminatePlayer(target[0]);
    }

    const anyCheck = PLAYERS.some(p => !eliminated.includes(p) && isInCheck3(p, board3, eliminated));
    playSound3(anyCheck ? 'check' : (isCapture ? 'capture' : 'move'));

    renderBoard3();
    renderHistory3();
}

// Interacción Humana
function handleSquareClick3(r, c) {
    if (isOver3 || isPaused3 || pendingPromo3) return;
    const color = currentColor3();
    
    if (isOnline3) {
        if (myColor3 !== color) return; // Solo puede jugar en su turno
    } else {
        if (cfg3[color] !== 'human') return; // En local, respetar configuración Humano/IA
    }

    const piece = board3[r][c];

    if (selectedSq) {
        const mv = legalMoves3.find(m => m.r === r && m.c === c);
        if (mv) {
            const movingPiece = board3[selectedSq.r][selectedSq.c];
            if (movingPiece[1] === 'p' && needsPromotion3(movingPiece, mv.r, mv.c)) {
                pendingPromo3 = { from: selectedSq, to: mv };
                showPromotionModal3(movingPiece[0]);
                selectedSq = null; legalMoves3 = [];
                return;
            }
            
            if (isOnline3) {
                socket.emit('movePiece3', { roomId: currentRoomId3, from: selectedSq, to: mv });
            } else {
                executeLocalMove3(selectedSq, mv);
                advanceTurnLocal3();
            }
            
            selectedSq = null; legalMoves3 = [];
            return;
        }
    }

    if (piece && piece[0] === color) {
        if (selectedSq && selectedSq.r === r && selectedSq.c === c) {
            selectedSq = null; legalMoves3 = [];
        } else {
            selectedSq = {r, c};
            legalMoves3 = getLegalMoves3(r, c, board3, eliminated);
        }
        renderBoard3();
    } else {
        selectedSq = null; legalMoves3 = [];
        renderBoard3();
    }
}

// Avance de turno Local (Solo Offline)
function advanceTurnLocal3() {
    let attempts = 0;
    const total = activePlayers.length;
    do {
        turnIndex = (turnIndex + 1) % total;
        attempts++;
    } while (eliminated.includes(currentColor3()) && attempts < total + 1);

    renderStatus3();

    const active = PLAYERS.filter(p => !eliminated.includes(p));
    if (active.length === 1) {
        endGame3(active[0]);
        return;
    }

    // Scheduling IA se hace desde el componente original si es offline
    // En online el server llama
}

function showPromotionModal3(color) {
    const optionsEl = document.getElementById('promotion-options3');
    if (!optionsEl) return;
    optionsEl.innerHTML = '';
    ['q','r','b','n'].forEach(type => {
        const btn = document.createElement('button');
        btn.className = `promotion-btn piece3 ${color}-piece`;
        btn.style.cssText = 'font-size:2.2rem; padding:8px 16px; background:transparent; border:1px solid #ccc; border-radius:8px; cursor:pointer;';
        btn.textContent = PIECE_ICONS[type];
        btn.onclick = () => {
            bsPromoModal.hide();
            const { from, to } = pendingPromo3;
            pendingPromo3 = null;
            
            if (isOnline3) {
                socket.emit('movePiece3', { roomId: currentRoomId3, from, to, promoType: type });
            } else {
                executeLocalMove3(from, to, type);
                advanceTurnLocal3();
            }
        };
        optionsEl.appendChild(btn);
    });
    bsPromoModal.show();
}

function eliminatePlayer(color) {
    if (eliminated.includes(color)) return;
    eliminated.push(color);
    for (let r = 0; r < BS; r++)
        for (let c = 0; c < BS; c++)
            if (board3[r][c] && board3[r][c][0] === color) board3[r][c] = null;
    document.getElementById(`card-${color}`)?.classList.add('eliminated');
    const st = document.getElementById(`status-${color}`);
    if (st) st.textContent = '💀 Eliminado';
}

function renderBoard3() {
    if (!boardEl3) return;
    boardEl3.innerHTML = '';

    const inCheck = {};
    PLAYERS.filter(p => !eliminated.includes(p)).forEach(p => {
        inCheck[p] = isInCheck3(p, board3, eliminated);
    });

    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            const sq = document.createElement('div');
            sq.classList.add('square3');

            if (!isValid3(r, c)) {
                sq.classList.add('invalid3');
            } else {
                sq.classList.add((r + c) % 2 === 0 ? 'light3' : 'dark3');

                if (lastMove3 && ((lastMove3.from.r === r && lastMove3.from.c === c) || (lastMove3.to.r === r && lastMove3.to.c === c)))
                    sq.classList.add('sq-lastmove');

                if (selectedSq && selectedSq.r === r && selectedSq.c === c)
                    sq.classList.add('sq-selected');

                if (legalMoves3.some(m => m.r === r && m.c === c)) {
                    sq.classList.add('sq-valid');
                    const dot = document.createElement('div');
                    dot.className = 'valid-dot3';
                    sq.appendChild(dot);
                }

                const piece = board3[r][c];
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece3 ${piece[0]}-piece`;
                    pieceEl.textContent = PIECE_ICONS[piece[1]];

                    if (piece[1] === 'k' && inCheck[piece[0]]) sq.classList.add('sq-check');

                    sq.appendChild(pieceEl);
                }

                sq.addEventListener('click', () => handleSquareClick3(r, c));
            }

            boardEl3.appendChild(sq);
        }
    }
}

function renderStatus3() {
    if (isOver3 || !statusEl3) return;
    const color = currentColor3();
    const name = PLAYER_NAMES[color];
    const check = isInCheck3(color, board3, eliminated);
    statusEl3.textContent = `Turno de las ${name}${check ? ' — ¡JAQUE!' : ''}`;

    activePlayers.forEach(p => {
        const card = document.getElementById(`card-${p}`);
        const st   = document.getElementById(`status-${p}`);
        const typeEl = document.getElementById(`type-${p}`);
        if (!card || !st) return;
        if (eliminated.includes(p)) return;

        const pts = scores3[p] || 0;
        if (typeEl) {
            let label = isOnline3 ? (p === myColor3 ? '👤 Tú' : '🌐 Enemigo') : (cfg3[p] === 'ai' ? '🤖 IA' : '👤 H');
            typeEl.textContent = `${label} — ${pts} pts`;
            typeEl.className = `badge ${cfg3[p] === 'ai' || isOnline3 && p !== myColor3 ? 'bg-danger' : 'bg-primary'}`;
            typeEl.style.fontSize = '0.65rem';
        }

        if (p === color) {
            card.classList.add('active-turn');
            st.textContent = (isOnline3 && p === myColor3) || (!isOnline3 && cfg3[p] === 'human') ? '🎮 Tu turno' : '🤖 Pensando...';
        } else {
            card.classList.remove('active-turn');
            st.textContent = '⏳ Esperando';
        }
    });
}

function renderHistory3() {
    if (!historyEl3) return;
    historyEl3.innerHTML = '';
    const colorMap = { w:'#555', b:'#222', r:'#e63946', g:'#16a34a' };
    const perTurn = activePlayers.length;
    moveHistory3.forEach((m, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:inline-block; margin:2px 4px; padding:2px 6px; border-radius:4px; font-size:0.8rem;';
        div.style.color = colorMap[m.color] || '#555';
        div.style.background = 'rgba(0,0,0,0.06)';
        div.textContent = `${Math.floor(i/perTurn)+1}${m.color}.${m.notation}`;
        historyEl3.appendChild(div);
    });
    historyEl3.scrollTop = historyEl3.scrollHeight;
}

function formatTime3(s) {
    const m = Math.floor(s/60), sec = s%60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
}

function startTimer3() {
    clearInterval(timer3);
    timer3 = setInterval(() => {
        if (isPaused3 || isOver3) return;
        timeLeft3--;
        if(timerEl3) timerEl3.textContent = `⏱️ ${formatTime3(timeLeft3)}`;
        if (timeLeft3 <= 0) {
            isOver3 = true;
            clearInterval(timer3);
            endGame3(null, true);
        }
    }, 1000);
}

function endGame3(winner, timeout = false) {
    playSound3('gameEnd');
    isOver3 = true;
    clearInterval(timer3);
    const msg = document.getElementById('game-over-msg3');
    if (msg) {
        if (timeout) {
            msg.textContent = '⏱️ ¡Tiempo agotado! La partida terminó en empate.';
        } else if (winner) {
            msg.textContent = `🏆 ¡Ganan las ${PLAYER_NAMES[winner]}!`;
        }
    }
    if (statusEl3) statusEl3.textContent = '¡Partida terminada!';
    if (bsGameOverModal) bsGameOverModal.show();
}

const chessSounds3 = {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    check: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3'),
    gameEnd: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3')
};

function initAudio3() {
    Object.values(chessSounds3).forEach(audio => {
        audio.volume = 0;
        audio.play().catch(()=>{});
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
    });
}

function playSound3(type) {
    if (chessSounds3[type]) {
        chessSounds3[type].currentTime = 0;
        chessSounds3[type].play().catch(()=>{});
    }
}

function applyTheme3(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.body.className = theme === 'dark' ? 'bg-dark' : 'bg-body';
    localStorage.setItem('ajedrezTheme', theme);
}

// Botones de UI
const startBtn = document.getElementById('start-game3-btn');
if(startBtn) startBtn.addEventListener('click', () => {
    if(bsRulesModal) bsRulesModal.hide();
    
    // Si estamos en online, le decimos al server que inicie la partida
    if (isOnline3) {
        socket.emit('startGame3', currentRoomId3);
    } else {
        startTimer3();
        renderStatus3();
    }
});

function createRoomOnline() {
    connectSocket3();
    isOnline3 = true;
    socket.emit('createRoom3', { time: '10' }, (res) => {
        if (res.success) {
            currentRoomId3 = res.roomId;
            myColor3 = res.color;
            alert(`Sala Creada. Código: ${res.roomId}`);
        }
    });
}

function joinRoomOnline(code) {
    connectSocket3();
    isOnline3 = true;
    socket.emit('joinRoom3', code, (res) => {
        if (res.success) {
            currentRoomId3 = res.roomId;
            myColor3 = res.color;
            board3 = res.board;
            turnIndex = activePlayers.indexOf(res.currentTurn);
            renderBoard3();
            renderStatus3();
        } else {
            alert(res.message);
        }
    });
}

// Funciones para que el frontend dispare
window.chess3_createOnline = createRoomOnline;
window.chess3_joinOnline = joinRoomOnline;

// Lógica de reset (offline)
function resetGame3() {
    board3 = buildInitialBoard3(activePlayers);
    turnIndex = 0;
    eliminated = [];
    selectedSq = null;
    legalMoves3 = [];
    lastMove3 = null;
    isOver3 = false;
    isPaused3 = false;
    pendingPromo3 = null;
    moveHistory3 = [];
    scores3 = { w:0, b:0, r:0, g:0 };
    timeLeft3 = totalTime3;
    clearInterval(timer3);
    renderBoard3();
    renderStatus3();
    if(historyEl3) historyEl3.innerHTML = '';
}

function initGame3() {
    document.addEventListener('click', initAudio3, { once: true });
    
    const configEl = document.getElementById('configModal3');
    if (configEl) bsConfigModal = new bootstrap.Modal(configEl);
    
    const rulesEl = document.getElementById('rulesModal3');
    if (rulesEl) bsRulesModal = new bootstrap.Modal(rulesEl);
    
    const overEl = document.getElementById('gameOverModal3');
    if (overEl) bsGameOverModal = new bootstrap.Modal(overEl);
    
    const promoEl = document.getElementById('promotionModal3');
    if (promoEl) bsPromoModal = new bootstrap.Modal(promoEl);

    resetGame3();
}

// Iniciar al cargar (en caso de que sea cargado directamente)
initGame3();
