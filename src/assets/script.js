import { io } from 'socket.io-client';
import { getBestMove, evaluateBoard } from '../logic/aiEngine.js';

// =========================================================================

// ESTADO GLOBAL Y VARIABLES
// =========================================================================

const PIECES = {
    w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

const INITIAL_BOARD = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

let board = [];
let currentTurn = 'w';
let moveHistory = [];
let capturedPieces = { w: [], b: [] }; // w: captured by white (black pieces), b: captured by black
let scores = { w: 0, b: 0 };           // Puntos acumulados por capturas
const CAPTURE_POINTS = { p:1, n:3, b:3, r:5, q:9 }; // Valor en puntos de cada pieza
let selectedSquare = null; 
let validMoves = []; 
let isGameOver = false;
let lastMove = null;
let isPaused = false;
let animationData = null;

// Configuración leída de menu.html
let config = { mode: 'pva', time: '10', difficulty: '3', isNewGame: true, roomCode: '' };

// Variables Online
let socket = null;
let isOnline = false;
let myColor = null;
let currentRoomId = null;

// Tiempos
let timeLimit = 600;
let globalTimeLeft = 600;
let timerInterval = null;

// Audio
let audioCtx = null;

// Promoción de Peones
let pendingPromotion = null; // Guarda los datos del movimiento mientras se muestra el modal

// =========================================================================
// ELEMENTOS DEL DOM
// =========================================================================

// Estas variables se inicializan cuando Vue ya ha montado el DOM (evento 'vue-mounted')
let boardEl, statusEl, historyEl, evalBarFill, evalText, globalTimerEl;
let capturedWhiteEl, capturedBlackEl;
let themeToggleBtn, restartBtn, pauseBtn, suggestBtn;
let confirmRestartBtn, modalRestartBtn, promotionOptionsEl;
let gameOverModal, restartModal, promotionModal;


// =========================================================================
// INICIALIZACIÓN Y CONFIGURACIÓN
// =========================================================================

function initModals() {
    gameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    restartModal = new bootstrap.Modal(document.getElementById('restartModal'));
    promotionModal = new bootstrap.Modal(document.getElementById('promotionModal'));
}

function initAudio() {
    Object.values(chessSounds).forEach(audio => {
        audio.volume = 0;
        audio.play().catch(()=>{});
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
    });
}

function initGame() {
    document.addEventListener('click', initAudio, { once: true });
    initModals();

    // Leer configuración
    config = JSON.parse(localStorage.getItem('ajedrezConfig') || '{"mode":"pva", "time":"10", "difficulty":"3", "isNewGame":true, "roomCode":""}');
    isOnline = config.mode === 'online';

    if (isOnline) {
        if (suggestBtn) suggestBtn.style.display = 'none';
        initSocketConnection();
        return; // Detiene el flujo normal hasta que el server responda
    }

    timeLimit = parseInt(config.time) * 60;

    if (config.isNewGame) {
        resetBoard();
        // Cambiar flag para que un F5 no vuelva a resetear
        config.isNewGame = false;
        localStorage.setItem('ajedrezConfig', JSON.stringify(config));
    } else {
        loadState();
        renderAll();
        if (!isGameOver) {
            startTimer();
            checkAITurn();
        }
    }

    setupTheme();
}

// =========================================================================
// CONEXIÓN SOCKET.IO (ONLINE)
// =========================================================================

function initSocketConnection() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    socket = io(backendUrl);
    statusEl.textContent = 'Conectando al servidor multijugador...';
    
    socket.on('connect', () => {
        console.log("Conectado al servidor. Configuración cargada:", config);
        
        // Validación ultra-estricta del código de sala
        const rCode = config.roomCode;
        const isValidCode = rCode && 
                            typeof rCode === 'string' && 
                            rCode.trim() !== "" && 
                            rCode !== "null" && 
                            rCode !== "undefined";

        if (isValidCode) {
            console.log(">> ACCIÓN: Intentando UNIRSE a sala:", rCode);
            socket.emit('joinRoom', rCode.trim(), handleRoomResponse);
        } else {
            console.log(">> ACCIÓN: Intentando CREAR sala nueva...");
            socket.emit('createRoom', { time: config.time }, handleRoomResponse);
        }
    });

    socket.on('gameStart', (data) => {
        board = data.board;
        currentTurn = data.currentTurn;
        statusEl.innerHTML = `Oponente conectado. <br> <strong>Eres las ${myColor === 'w' ? 'BLANCAS' : 'NEGRAS'}</strong>.`;
        
        // Ocultar panel de sala al empezar
        const roomPanel = document.getElementById('online-room-panel');
        if (roomPanel) roomPanel.classList.add('d-none');

        boardEl.style.pointerEvents = 'auto'; // Desbloquear tablero
        renderBoard();
        startTimer();
    });

    socket.on('opponentMove', (moveData) => {
        // Ejecutar el movimiento del oponente localmente para animaciones/historial
        const fromRect = getSquareRect(moveData.from.r, moveData.from.c);
        processMove(moveData.from, moveData.to, fromRect, true);
    });

    socket.on('opponentDisconnected', (data) => {
        statusEl.textContent = data.message;
        isGameOver = true;
    });
}

function handleRoomResponse(res) {
    if (res.success) {
        currentRoomId = res.roomId;
        myColor = res.color;
        if (myColor === 'w') {
            statusEl.textContent = `Esperando oponente...`;
            
            // Mostrar panel de sala destacado
            const roomPanel = document.getElementById('online-room-panel');
            const codeDisplay = document.getElementById('room-code-display');
            const copyBtn = document.getElementById('copy-room-btn');
            
            if (roomPanel && codeDisplay) {
                roomPanel.classList.remove('d-none');
                codeDisplay.textContent = currentRoomId;
                
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(currentRoomId);
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '¡Copiado!';
                    copyBtn.classList.replace('btn-primary', 'btn-success');
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.classList.replace('btn-success', 'btn-primary');
                    }, 2000);
                };
            }

            boardEl.style.pointerEvents = 'none'; // Bloquear interacciones hasta gameStart
            initNewGameLocal(); // Inicializa visualmente el tablero local pero bloqueado
        } else {
            board = res.board;
            currentTurn = res.currentTurn;
            config.time = res.timeConfig; 
            timeLimit = parseInt(config.time) * 60;
            globalTimeLeft = timeLimit;
            statusEl.innerHTML = `¡Conectado! <br> <strong>Eres las NEGRAS</strong>.`;
            renderBoard();
            updateStatus();
            startTimer();
        }
    } else {
        console.error("Error del servidor:", res.message);
        alert(res.message);
        
        // LIMPIEZA DE EMERGENCIA: Si la sala no existe, borramos el código para que la próxima vez CREÉ una.
        const staleConfig = JSON.parse(localStorage.getItem('ajedrezConfig') || '{}');
        staleConfig.roomCode = null;
        localStorage.setItem('ajedrezConfig', JSON.stringify(staleConfig));
        
        window.location.href = '/';
    }
}

function initNewGameLocal() {
    board = JSON.parse(JSON.stringify(INITIAL_BOARD));
    currentTurn = 'w';
    moveHistory = [];
    capturedPieces = { w: [], b: [] };
    scores = { w: 0, b: 0 };
    isGameOver = false;
    isPaused = false;
    timeLimit = parseInt(config.time) * 60;
    globalTimeLeft = timeLimit;
    lastMove = null;
    statusEl.textContent = "Turno de las Blancas";
    pauseBtn.innerHTML = "⏸️ Pausar Juego";
    pauseBtn.classList.remove('btn-success');
    pauseBtn.classList.add('btn-warning');
    renderBoard();
    updateEvaluation();
    updateCapturedUI();
    renderHistory();
}

function resetBoard() {
    board = INITIAL_BOARD.map(row => [...row]);
    currentTurn = 'w';
    moveHistory = [];
    capturedPieces = { w: [], b: [] };
    scores = { w: 0, b: 0 };
    selectedSquare = null;
    validMoves = [];
    lastMove = null;
    isGameOver = false;
    isPaused = false;
    
    globalTimeLeft = timeLimit;
    pauseBtn.innerHTML = "⏸️ Pausar Juego";
    
    saveState();
    renderAll();
    startTimer();
    checkAITurn();
}

function renderAll() {
    renderBoard();
    updateStatus();
    renderHistory();
    renderCapturedPieces();
    updateEvaluation();
    updateTimerUI();
}

// =========================================================================
// ESTADO LOCAL (GUARDAR/CARGAR)
// =========================================================================

function saveState() {
    const state = {
        board, currentTurn, moveHistory, capturedPieces,
        scores, isGameOver, lastMove, globalTimeLeft
    };
    localStorage.setItem('ajedrezState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('ajedrezState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            board = state.board;
            currentTurn = state.currentTurn;
            moveHistory = state.moveHistory || [];
            capturedPieces = state.capturedPieces || { w: [], b: [] };
            scores = state.scores || { w: 0, b: 0 };
            isGameOver = state.isGameOver || false;
            lastMove = state.lastMove || null;
            globalTimeLeft = state.globalTimeLeft !== undefined ? state.globalTimeLeft : timeLimit;
        } catch (e) {
            console.error("Error loading state", e);
        }
    }
}

// =========================================================================
// INTERFAZ DE USUARIO (UI) / RENDERIZADO
// =========================================================================

function renderBoard() {
    boardEl.innerHTML = '';
    let isKingInCheck = { w: false, b: false };
    if (isInCheck('w', board)) isKingInCheck.w = true;
    if (isInCheck('b', board)) isKingInCheck.b = true;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareEl = document.createElement('div');
            squareEl.classList.add('square');
            if ((r + c) % 2 === 0) squareEl.classList.add('light');
            else squareEl.classList.add('dark');

            // Resaltar último movimiento
            if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
                squareEl.classList.add('last-move');
            }

            squareEl.dataset.row = r;
            squareEl.dataset.col = c;

            const piece = board[r][c];
            if (piece) {
                const color = piece[0];
                const type = piece[1];
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                pieceEl.classList.add(color === 'w' ? 'white-piece' : 'black-piece');
                pieceEl.textContent = PIECES[color][type];
                
                const isHumanTurn = !isGameOver && !isPaused && (config.mode === 'pvp' || (config.mode === 'pva' && currentTurn === 'w'));
                pieceEl.draggable = isHumanTurn && (color === currentTurn);
                
                pieceEl.dataset.row = r;
                pieceEl.dataset.col = c;
                
                pieceEl.addEventListener('dragstart', handleDragStart);
                pieceEl.addEventListener('dragend', handleDragEnd);
                
                if (animationData && animationData.to.r === r && animationData.to.c === c) {
                    pieceEl.style.opacity = '0';
                    animationData.targetPieceEl = pieceEl;
                }

                squareEl.appendChild(pieceEl);

                if (type === 'k' && isKingInCheck[color]) squareEl.classList.add('check');
            }

            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                squareEl.classList.add('selected');
            }

            const isValid = validMoves.some(m => m.r === r && m.c === c);
            if (isValid) {
                const dot = document.createElement('div');
                dot.classList.add('valid-move-indicator');
                squareEl.appendChild(dot);
            }

            squareEl.addEventListener('click', () => handleSquareClick(r, c));
            squareEl.addEventListener('dragover', handleDragOver);
            squareEl.addEventListener('drop', handleDrop);

            boardEl.appendChild(squareEl);
        }
    }
}

function updateStatus() {
    if (isGameOver) return;
    if (isPaused) {
        statusEl.textContent = "Juego Pausado";
        return;
    }
    
    const isCheck = isInCheck(currentTurn, board);
    const hasMoves = hasAnyLegalMoves(currentTurn);

    if (!hasMoves) {
        isGameOver = true;
        clearInterval(timerInterval);
        if (isCheck) {
            statusEl.textContent = "¡Jaque Mate!";
            showGameOver(currentTurn === 'w' ? 'Negras' : 'Blancas', true, "Jaque Mate");
        } else {
            statusEl.textContent = "Tablas (Rey Ahogado)";
            showGameOver("Nadie", false, "Empate por ahogado");
        }
    } else {
        const colorName = currentTurn === 'w' ? 'Blancas' : 'Negras';
        statusEl.textContent = `Turno de las ${colorName}${isCheck ? ' - ¡JAQUE!' : ''}`;
    }
}

function renderHistory() {
    historyEl.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const wMove = moveHistory[i];
        const bMove = moveHistory[i + 1] || '';

        const numEl = document.createElement('div');
        numEl.classList.add('move-number');
        numEl.textContent = `${moveNum}.`;
        
        const wEl = document.createElement('div');
        wEl.classList.add('move-item');
        wEl.textContent = wMove;

        const bEl = document.createElement('div');
        bEl.classList.add('move-item');
        bEl.textContent = bMove;

        historyEl.appendChild(numEl);
        historyEl.appendChild(wEl);
        historyEl.appendChild(bEl);
    }
    historyEl.scrollTop = historyEl.scrollHeight;
}

function renderCapturedPieces() {
    const renderList = (arr, container, color) => {
        const pts = scores[color] || 0;
        const label = color === 'w' ? 'Blancas' : 'Negras';
        container.innerHTML = `<span class="badge ${color === 'w' ? 'bg-light text-dark border' : 'bg-dark text-white'} me-2">${label} <span class="badge bg-warning text-dark ms-1">${pts} pts</span></span>`;
        arr.forEach(p => {
            const span = document.createElement('span');
            span.className = `piece captured-piece ${p[0] === 'w' ? 'white-piece' : 'black-piece'}`;
            span.textContent = PIECES[p[0]][p[1]];
            container.appendChild(span);
        });
    };

    renderList(capturedPieces.w, capturedWhiteEl, 'w');
    renderList(capturedPieces.b, capturedBlackEl, 'b');
}

function showGameOver(winner, isMate, reason = "") {
    playSound('gameEnd');
    document.getElementById('game-over-title').textContent = isMate ? "¡Jaque Mate!" : "Tablas";
    document.getElementById('game-over-message').textContent = isMate ? `¡Ganan las ${winner}!` : reason;
    gameOverModal.show();
}

// --- Tiempos ---
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTimerUI() {
    globalTimerEl.textContent = `⏱️ ${formatTime(globalTimeLeft)}`;
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isPaused || isGameOver) return;
        if (config.mode === 'ava') return;

        globalTimeLeft--;
        updateTimerUI();

        if (globalTimeLeft <= 0) {
            isGameOver = true;
            clearInterval(timerInterval);
            updateTimerUI();
            showGameOver("Empate", false, "Se agotó el tiempo de la partida.");
        }
    }, 1000);
}

// --- Sonidos ---
const chessSounds = {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    check: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3'),
    gameEnd: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3')
};

function playSound(type) {
    if (chessSounds[type]) {
        chessSounds[type].currentTime = 0;
        chessSounds[type].play().catch(() => {});
    }
}

// =========================================================================
// INTERACCIÓN HUMANA (CLICS Y DRAG/DROP)
// =========================================================================

let draggedSquare = null;

function getSquareRect(r, c) {
    const sq = document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
    return sq ? sq.getBoundingClientRect() : null;
}

function handleSquareClick(r, c) {
    if (isGameOver || isPaused || pendingPromotion) return;
    
    if (isOnline) {
        if (myColor !== currentTurn) return;
    } else {
        if (config.mode === 'ava' || (config.mode === 'pva' && currentTurn === 'b')) return;
    }

    const piece = board[r][c];

    if (selectedSquare) {
        const move = validMoves.find(m => m.r === r && m.c === c);
        if (move) {
            const fromRect = getSquareRect(selectedSquare.r, selectedSquare.c);
            processMove(selectedSquare, move, fromRect);
            selectedSquare = null;
            validMoves = [];
            return;
        }
    }

    if (piece && piece[0] === currentTurn) {
        if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
            selectedSquare = null;
            validMoves = [];
        } else {
            selectedSquare = {r, c};
            validMoves = getLegalMoves(r, c, board);
        }
        renderBoard();
    } else {
        selectedSquare = null;
        validMoves = [];
        renderBoard();
    }
}

function handleDragStart(e) {
    if (isGameOver || isPaused || pendingPromotion) return;
    
    if (isOnline) {
        if (myColor !== currentTurn) { e.preventDefault(); return; }
    } else {
        if (config.mode === 'ava' || (config.mode === 'pva' && currentTurn === 'b')) {
            e.preventDefault(); return;
        }
    }

    const r = parseInt(e.target.dataset.row);
    const c = parseInt(e.target.dataset.col);
    const piece = board[r][c];
    
    if (!piece || piece[0] !== currentTurn) { e.preventDefault(); return; }

    draggedSquare = {r, c};
    selectedSquare = {r, c};
    validMoves = getLegalMoves(r, c, board);
    setTimeout(() => { e.target.classList.add('dragging'); renderBoard(); }, 0);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedSquare = null;
    renderBoard();
}

function handleDragOver(e) { e.preventDefault(); }

function handleDrop(e) {
    e.preventDefault();
    if (!draggedSquare) return;

    let target = e.target;
    if (target.classList.contains('piece') || target.classList.contains('valid-move-indicator')) target = target.parentElement;
    if (!target.classList.contains('square')) return;

    const r = parseInt(target.dataset.row);
    const c = parseInt(target.dataset.col);

    const move = validMoves.find(m => m.r === r && m.c === c);
    if (move) processMove(draggedSquare, move, null);
    
    selectedSquare = null;
    validMoves = [];
    draggedSquare = null;
    renderBoard();
}

// =========================================================================
// LÓGICA DEL JUEGO (MOVIMIENTOS)
// =========================================================================

function processMove(from, to, fromRectForAnimation, isFromOpponent = false) {
    if (from.r === to.r && from.c === to.c) return;
    if (isGameOver) return;

    const piece = board[from.r][from.c];
    
    // Solo emitimos al server si nosotros lo movimos (no es recibido del oponente)
    if (isOnline && !isFromOpponent) {
        socket.emit('movePiece', { roomId: currentRoomId, from, to });
    }
    
    // Detectar si requiere promoción humana
    if (piece[1] === 'p' && (to.r === 0 || to.r === 7)) {
        // Pausar y pedir promoción si es el humano (y no es el oponente remoto moviendo)
        if (!isFromOpponent && (config.mode === 'pvp' || (config.mode === 'pva' && currentTurn === 'w') || config.mode === 'online')) {
            pendingPromotion = { from, to, fromRectForAnimation };
            showPromotionModal(currentTurn);
            return;
        }
    }
    executeMove(from, to, fromRectForAnimation, 'q'); // IA o movimiento remoto promueve a Reina por defecto (mejorable)
}

function showPromotionModal(color) {
    promotionOptionsEl.innerHTML = '';
    ['q', 'r', 'b', 'n'].forEach(type => {
        const btn = document.createElement('button');
        btn.className = `piece promotion-btn ${color === 'w' ? 'white-piece' : 'black-piece'}`;
        btn.textContent = PIECES[color][type];
        btn.onclick = () => {
            promotionModal.hide();
            const { from, to, fromRectForAnimation } = pendingPromotion;
            pendingPromotion = null;
            executeMove(from, to, fromRectForAnimation, type);
        };
        promotionOptionsEl.appendChild(btn);
    });
    promotionModal.show();
}

function executeMove(from, to, fromRectForAnimation, promotionPiece = 'q') {
    const piece = board[from.r][from.c];
    const targetPiece = board[to.r][to.c];
    const isCapture = targetPiece !== null;
    
    // Capturas
    if (isCapture) {
        capturedPieces[currentTurn].push(targetPiece);
        scores[currentTurn] += CAPTURE_POINTS[targetPiece[1]] || 0;
        // Ordenar por valor para estética
        const valOrder = { 'q': 5, 'r': 4, 'b': 3, 'n': 2, 'p': 1 };
        capturedPieces[currentTurn].sort((a,b) => valOrder[b[1]] - valOrder[a[1]]);
    }
    
    // Notación
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    let notation = piece[1] !== 'p' ? piece[1].toUpperCase() : '';
    if (isCapture) notation += 'x';
    notation += files[to.c] + ranks[to.r];
    
    // Aplicar movimiento
    board[to.r][to.c] = piece;
    board[from.r][from.c] = null;

    if (piece[1] === 'p' && (to.r === 0 || to.r === 7)) {
        board[to.r][to.c] = piece[0] + promotionPiece;
        notation += '=' + promotionPiece.toUpperCase();
    }

    currentTurn = currentTurn === 'w' ? 'b' : 'w';
    
    const isCheck = isInCheck(currentTurn, board);
    if (isCheck) {
        if (!hasAnyLegalMoves(currentTurn)) notation += '#';
        else notation += '+';
    }

    moveHistory.push(notation);
    lastMove = { from, to };
    
    // Animación FLIP
    if (fromRectForAnimation) {
        const toRect = getSquareRect(to.r, to.c);
        if (toRect) {
            animationData = { from, to };
            renderAll(); 
            
            const clone = document.createElement('div');
            clone.textContent = PIECES[piece[0]][piece[1]];
            clone.className = `piece animating ${piece[0] === 'w' ? 'white-piece' : 'black-piece'}`;
            clone.style.left = fromRectForAnimation.left + 'px';
            clone.style.top = fromRectForAnimation.top + 'px';
            clone.style.width = fromRectForAnimation.width + 'px';
            clone.style.height = fromRectForAnimation.height + 'px';
            document.body.appendChild(clone);
            
            clone.getBoundingClientRect(); // Reflow
            clone.style.transform = `translate(${toRect.left - fromRectForAnimation.left}px, ${toRect.top - fromRectForAnimation.top}px)`;
            
            setTimeout(() => {
                clone.remove();
                if (animationData && animationData.targetPieceEl) animationData.targetPieceEl.style.opacity = '1';
                animationData = null;
                
                if (isCheck) playSound('check');
                else if (isCapture) playSound('capture');
                else playSound('move');
                
                finishMoveExecution();
            }, 400); 
            return;
        }
    }

    if (isCheck) playSound('check');
    else if (isCapture) playSound('capture');
    else playSound('move');
    
    renderAll();
    finishMoveExecution();
}

function finishMoveExecution() {
    saveState();
    checkAITurn();
}

// Simulaciones para validación y IA
function applyMoveSim(b, move) {
    const piece = b[move.from.r][move.from.c];
    const targetPiece = b[move.to.r][move.to.c];
    b[move.to.r][move.to.c] = piece;
    b[move.from.r][move.from.c] = null;
    let promoted = false;
    if (piece[1] === 'p' && (move.to.r === 0 || move.to.r === 7)) {
        b[move.to.r][move.to.c] = piece[0] + 'q';
        promoted = true;
    }
    return { piece, targetPiece, promoted };
}

function undoMoveSim(b, move, simData) {
    b[move.from.r][move.from.c] = simData.piece;
    b[move.to.r][move.to.c] = simData.targetPiece;
}

function getLegalMoves(r, c, b) {
    const pseudoMoves = getPseudoLegalMoves(r, c, b);
    const color = b[r][c][0];
    return pseudoMoves.filter(move => {
        const fullMove = { from: {r, c}, to: move };
        const simData = applyMoveSim(b, fullMove);
        const ok = !isInCheck(color, b);
        undoMoveSim(b, fullMove, simData);
        return ok;
    });
}

function getAllLegalMoves(color, b) {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] && b[r][c][0] === color) {
                getLegalMoves(r, c, b).forEach(lm => moves.push({ from: {r, c}, to: lm }));
            }
        }
    }
    return moves;
}

function hasAnyLegalMoves(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] && board[r][c][0] === color) {
                if (getLegalMoves(r, c, board).length > 0) return true;
            }
        }
    }
    return false;
}

function isInCheck(color, b) {
    let kr = -1, kc = -1;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] === color + 'k') { kr = r; kc = c; break; }
        }
        if (kr !== -1) break;
    }
    if (kr === -1) return false;
    const enemyColor = color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] && b[r][c][0] === enemyColor) {
                if (getPseudoLegalMoves(r, c, b).some(m => m.r === kr && m.c === kc)) return true;
            }
        }
    }
    return false;
}

function getPseudoLegalMoves(r, c, b) {
    const piece = b[r][c];
    if (!piece) return [];
    const color = piece[0], type = piece[1], moves = [];

    function addMove(nr, nc) {
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const target = b[nr][nc];
            if (!target) { moves.push({r: nr, c: nc}); return true; }
            else if (target[0] !== color) { moves.push({r: nr, c: nc}); return false; }
            return false;
        }
        return false; 
    }
    function slidingMoves(dirs) {
        dirs.forEach(d => {
            let nr = r + d[0], nc = c + d[1];
            while (addMove(nr, nc)) { nr += d[0]; nc += d[1]; }
        });
    }

    switch (type) {
        case 'p':
            const dir = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;
            if (r + dir >= 0 && r + dir < 8 && !b[r + dir][c]) {
                moves.push({r: r + dir, c: c});
                if (r === startRow && !b[r + 2 * dir][c]) moves.push({r: r + 2 * dir, c: c});
            }
            if (r + dir >= 0 && r + dir < 8) {
                if (c - 1 >= 0 && b[r + dir][c - 1] && b[r + dir][c - 1][0] !== color) moves.push({r: r + dir, c: c - 1});
                if (c + 1 < 8 && b[r + dir][c + 1] && b[r + dir][c + 1][0] !== color) moves.push({r: r + dir, c: c + 1});
            }
            break;
        case 'n':
            [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]].forEach(d => addMove(r + d[0], c + d[1]));
            break;
        case 'b': slidingMoves([[-1,-1], [-1,1], [1,-1], [1,1]]); break;
        case 'r': slidingMoves([[-1,0], [1,0], [0,-1], [0,1]]); break;
        case 'q': slidingMoves([[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]]); break;
        case 'k': [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]].forEach(d => addMove(r + d[0], c + d[1])); break;
    }
    return moves;
}

// =========================================================================
// INTELIGENCIA ARTIFICIAL (IA)
// =========================================================================


function checkAITurn() {
    if (isGameOver || isPaused || pendingPromotion) return;
    if (isOnline) return; // No hay IA en modo online
    
    const isAITurn = (config.mode === 'ava') || (config.mode === 'pva' && currentTurn === 'b');

    if (isAITurn) {
        const depth = parseInt(config.difficulty);
        statusEl.textContent = "IA Pensando...";
        setTimeout(() => {
            if (isGameOver || isPaused || pendingPromotion) return;
            const res = getBestMove(board, depth, currentTurn);
            if (res && res.move) {
                const fromRect = getSquareRect(res.move.from.r, res.move.from.c);
                processMove(res.move.from, res.move.to, fromRect);
            }
        }, 500);
    }
}

function updateEvaluation() {
    const score = evaluateBoard(board);
    let percentage = 50 + (score / 15) * 50;
    if (percentage > 100) percentage = 100;
    if (percentage < 0) percentage = 0;
    
    evalBarFill.style.height = `${percentage}%`;
    evalText.textContent = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}


function setupTheme() {
    let savedTheme = localStorage.getItem('ajedrezTheme');
    if (!savedTheme) savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.body.className = theme === 'dark' ? 'bg-dark' : 'bg-body';
    localStorage.setItem('ajedrezTheme', theme);
}


function bindDOMElements() {
    boardEl           = document.getElementById('chessboard');
    statusEl          = document.getElementById('status-display');
    historyEl         = document.getElementById('move-history');
    evalBarFill       = document.getElementById('eval-bar-fill');
    evalText          = document.getElementById('eval-text');
    globalTimerEl     = document.getElementById('global-timer');
    capturedWhiteEl   = document.getElementById('captured-white');
    capturedBlackEl   = document.getElementById('captured-black');
    themeToggleBtn    = document.getElementById('theme-toggle');
    restartBtn        = document.getElementById('restart-btn');
    pauseBtn          = document.getElementById('pause-btn');
    suggestBtn        = document.getElementById('suggest-btn');
    confirmRestartBtn = document.getElementById('confirm-restart-btn');
    modalRestartBtn   = document.getElementById('modal-restart-btn');
    promotionOptionsEl = document.getElementById('promotion-options');

    // Registrar eventos de botones
    suggestBtn.addEventListener('click', () => {
        if (isGameOver || isPaused || pendingPromotion || isOnline) return;
        statusEl.textContent = 'Calculando sugerencia...';
        setTimeout(() => {
            const depth = 3; // Profundidad fija para sugerencias
            const res = getBestMove(board, depth, currentTurn);
            if (res && res.move) {
                selectedSquare = res.move.from;
                validMoves = [res.move.to];
                renderBoard();
                statusEl.textContent = 'Sugerencia lista.';
                setTimeout(() => updateStatus(), 2000);
            }
        }, 50);
    });

    pauseBtn.addEventListener('click', () => {
        if (isGameOver) return;
        isPaused = !isPaused;
        pauseBtn.innerHTML = isPaused ? '▶️ Reanudar Juego' : '⏸️ Pausar Juego';
        pauseBtn.classList.toggle('btn-success', isPaused);
        pauseBtn.classList.toggle('btn-warning', !isPaused);
        updateStatus();
        if (!isPaused) checkAITurn();
    });

    restartBtn.addEventListener('click', () => restartModal.show());
    confirmRestartBtn.addEventListener('click', () => { restartModal.hide(); resetBoard(); });
    modalRestartBtn.addEventListener('click', () => { gameOverModal.hide(); resetBoard(); });
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
}

if (window.vueIsMounted) {
    bindDOMElements();
    initGame();
} else {
    window.addEventListener('vue-mounted', () => {
        bindDOMElements();
        initGame();
    });
}
