// =========================================================================
// AJEDREZ DE 3-4 JUGADORES - chess3.js
// Tablero 14×14 con esquinas 3×3 inválidas (forma de estrella)
// Jugadores: Blancas (bottom), Negras (top), Rojas (right), Verdes (left)
// =========================================================================

const BS = 14; // Board Size
const CS = 3;  // Corner Size (3x3 corners are invalid)

const PLAYERS = ['w', 'b', 'r', 'g'];
const PLAYER_NAMES = { w: 'Blancas', b: 'Negras', r: 'Rojas', g: 'Verdes' };
const PIECE_ICONS = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
const PIECE_VALUES = { p:10, n:30, b:30, r:50, q:90, k:900 };
const CAPTURE_PTS3  = { p:1, n:3, b:3, r:5, q:9 }; // Puntos por captura (modo 3/4 jugadores)

// --- Game State ---
let board3 = [];
let turnIndex = 0;         // 0=w, 1=b, 2=r
let eliminated = [];       // Array of eliminated colors e.g. ['r']
let selectedSq = null;
let legalMoves3 = [];
let lastMove3 = null;
let isOver3 = false;
let isPaused3 = false;
let pendingPromo3 = null;
let moveHistory3 = [];

// Qué jugadores están activos (configurable desde UI)
let activePlayers = ['w','b','r']; // default 3-player

// Config from menu (AI/human for each player)
let cfg3 = { w:'human', b:'ai', r:'ai', g:'ai' };

// Puntos por capturas
let scores3 = { w:0, b:0, r:0, g:0 };

// Timer
let timeLeft3 = 600;
let totalTime3 = 600; // saved for reset
let timer3 = null;
let audioCtx3 = null;

// Bootstrap Modals
let bsConfigModal, bsRulesModal, bsGameOverModal, bsPromoModal;

// DOM
const boardEl3    = document.getElementById('chessboard3');
const statusEl3   = document.getElementById('status-display3');
const timerEl3    = document.getElementById('global-timer3');
const historyEl3  = document.getElementById('move-history3');

// =========================================================================
// BOARD GEOMETRY
// =========================================================================

/** Returns true if (r,c) is a playable square */
function isValid3(r, c) {
    if (r < 0 || r >= BS || c < 0 || c >= BS) return false;
    if (r < CS && c < CS) return false;          // top-left corner
    if (r < CS && c >= BS - CS) return false;    // top-right corner
    if (r >= BS - CS && c < CS) return false;    // bottom-left corner
    if (r >= BS - CS && c >= BS - CS) return false; // bottom-right corner
    return true;
}

/** Build the initial board (supports 3 or 4 players depending on activePlayers) */
function buildInitialBoard3() {
    const b = Array.from({length: BS}, () => Array(BS).fill(null));

    // WHITE (bottom) - rows 12-13, cols 3-10
    const wBack = ['wr','wn','wb','wq','wk','wb','wn','wr'];
    for (let i = 0; i < 8; i++) { b[13][3+i] = wBack[i]; b[12][3+i] = 'wp'; }

    // BLACK (top) - rows 0-1, cols 3-10
    const bBack = ['br','bn','bb','bq','bk','bb','bn','br'];
    for (let i = 0; i < 8; i++) { b[0][3+i] = bBack[i]; b[1][3+i] = 'bp'; }

    // RED (right) - cols 12-13, rows 3-10
    const rBack = ['rr','rn','rb','rq','rk','rb','rn','rr'];
    for (let i = 0; i < 8; i++) { b[3+i][13] = rBack[i]; b[3+i][12] = 'rp'; }

    // GREEN (left) - cols 0-1, rows 3-10 (only if active)
    if (activePlayers.includes('g')) {
        const gBack = ['gr','gn','gb','gq','gk','gb','gn','gr'];
        for (let i = 0; i < 8; i++) { b[3+i][0] = gBack[i]; b[3+i][1] = 'gp'; }
    }

    return b;
}

// =========================================================================
// MOVE GENERATION
// =========================================================================

function getPawnMoves3(r, c, b) {
    const color = b[r][c][0];
    const moves = [];

    // Each player's pawn moves in a different direction
    let dr, dc, startR, startC, capDirs;
    if (color === 'w') {
        dr=-1; dc=0; startR=12; startC=null;
        capDirs=[[-1,-1],[-1,1]];
    } else if (color === 'b') {
        dr=1;  dc=0; startR=1;  startC=null;
        capDirs=[[1,-1],[1,1]];
    } else if (color === 'r') {
        dr=0; dc=-1; startR=null; startC=12;
        capDirs=[[-1,-1],[1,-1]];
    } else { // g (green) - moves right
        dr=0; dc=1; startR=null; startC=1;
        capDirs=[[-1,1],[1,1]];
    }

    // Forward
    const nr = r + dr, nc = c + dc;
    if (isValid3(nr, nc) && !b[nr][nc]) {
        moves.push({r:nr, c:nc});
        // Double from start
        const isStart = (color==='w' && r===startR) || (color==='b' && r===startR)
                      || (color==='r' && c===startC) || (color==='g' && c===startC);
        const nr2 = r + 2*dr, nc2 = c + 2*dc;
        if (isStart && isValid3(nr2, nc2) && !b[nr2][nc2]) moves.push({r:nr2, c:nc2});
    }

    // Diagonal captures (any enemy)
    for (const [dro, dco] of capDirs) {
        const cr = r + dro, cc = c + dco;
        if (isValid3(cr, cc) && b[cr][cc] && b[cr][cc][0] !== color) moves.push({r:cr, c:cc});
    }

    return moves;
}

function getPseudoMoves3(r, c, b) {
    const piece = b[r][c];
    if (!piece) return [];
    const color = piece[0], type = piece[1], moves = [];

    function addMove(nr, nc) {
        if (!isValid3(nr, nc)) return false;
        const t = b[nr][nc];
        if (!t) { moves.push({r:nr, c:nc}); return true; }
        if (t[0] !== color) { moves.push({r:nr, c:nc}); return false; }
        return false;
    }
    function slide(dirs) {
        for (const [dr, dc] of dirs) {
            let nr = r+dr, nc = c+dc;
            while (addMove(nr, nc)) { nr+=dr; nc+=dc; }
        }
    }

    switch (type) {
        case 'p': return getPawnMoves3(r, c, b);
        case 'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([a,b]) => addMove(r+a,c+b)); break;
        case 'b': slide([[-1,-1],[-1,1],[1,-1],[1,1]]); break;
        case 'r': slide([[-1,0],[1,0],[0,-1],[0,1]]); break;
        case 'q': slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]); break;
        case 'k': [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([a,b]) => addMove(r+a,c+b)); break;
    }
    return moves;
}

// =========================================================================
// CHECK DETECTION
// =========================================================================

function findKing3(color, b) {
    for (let r = 0; r < BS; r++)
        for (let c = 0; c < BS; c++)
            if (b[r][c] === color + 'k') return {r, c};
    return null;
}

/** Is `color` in check by any active enemy? */
function isInCheck3(color, b) {
    const king = findKing3(color, b);
    if (!king) return false;
    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            const p = b[r][c];
            if (p && p[0] !== color && !eliminated.includes(p[0])) {
                if (getPseudoMoves3(r, c, b).some(m => m.r === king.r && m.c === king.c)) return true;
            }
        }
    }
    return false;
}

// =========================================================================
// LEGAL MOVES (after filtering moves leaving own king in check)
// =========================================================================

function applyMoveSim3(b, from, to) {
    const piece = b[from.r][from.c];
    const captured = b[to.r][to.c];
    b[to.r][to.c] = piece;
    b[from.r][from.c] = null;
    return captured;
}

function undoMoveSim3(b, from, to, captured, origPiece) {
    b[from.r][from.c] = origPiece;
    b[to.r][to.c] = captured;
}

function getLegalMoves3(r, c, b) {
    const color = b[r][c][0];
    return getPseudoMoves3(r, c, b).filter(to => {
        const piece = b[r][c];
        const captured = applyMoveSim3(b, {r, c}, to);
        const inCheck = isInCheck3(color, b);
        undoMoveSim3(b, {r, c}, to, captured, piece);
        return !inCheck;
    });
}

function hasLegalMoves3(color) {
    for (let r = 0; r < BS; r++)
        for (let c = 0; c < BS; c++)
            if (board3[r][c] && board3[r][c][0] === color)
                if (getLegalMoves3(r, c, board3).length > 0) return true;
    return false;
}

// =========================================================================
// PAWN PROMOTION CHECK
// =========================================================================

function needsPromotion3(piece, r, c) {
    if (!piece || piece[1] !== 'p') return false;
    if (piece[0] === 'w' && r === 0)        return true;
    if (piece[0] === 'b' && r === BS - 1)   return true;
    if (piece[0] === 'r' && c === 0)        return true;
    if (piece[0] === 'g' && c === BS - 1)   return true; // green promotes at col 13
    return false;
}

// =========================================================================
// EXECUTE MOVE
// =========================================================================

function executeMove3(from, to, promoType = 'q') {
    const piece = board3[from.r][from.c];
    const target = board3[to.r][to.c];
    const isCapture = target !== null;

    // Move piece
    board3[to.r][to.c] = piece;
    board3[from.r][from.c] = null;

    // Sumar puntos al capturador
    if (isCapture && target[1] !== 'k') {
        scores3[piece[0]] = (scores3[piece[0]] || 0) + (CAPTURE_PTS3[target[1]] || 0);
    }

    // Promotion
    let promoNotation = '';
    if (needsPromotion3(piece, to.r, to.c)) {
        board3[to.r][to.c] = piece[0] + promoType;
        promoNotation = '=' + promoType.toUpperCase();
    }

    // Notation
    const files = 'abcdefghijklmn';
    const notation = `${piece[1] !== 'p' ? piece[1].toUpperCase() : ''}${isCapture ? 'x' : ''}${files[to.c]}${14 - to.r}${promoNotation}`;
    moveHistory3.push({ color: piece[0], notation });

    lastMove3 = { from, to };

    // Check if any enemy king was captured → eliminate that player
    if (isCapture && target[1] === 'k') {
        eliminatePlayer(target[0]);
    }

    // Play sound
    const anyCheck = PLAYERS.some(p => !eliminated.includes(p) && isInCheck3(p, board3));
    if (anyCheck) {
        playSound3('check');
    } else {
        playSound3(isCapture ? 'capture' : 'move');
    }

    // Advance turn
    advanceTurn3();

    // Render
    renderBoard3();
    renderStatus3();
    renderHistory3();

    // Check win condition
    const active = PLAYERS.filter(p => !eliminated.includes(p));
    if (active.length === 1) {
        endGame3(active[0]);
        return;
    }

    // Check AI turn
    scheduleAITurn3();
}

function eliminatePlayer(color) {
    if (eliminated.includes(color)) return;
    eliminated.push(color);
    // Remove all pieces of this player from the board
    for (let r = 0; r < BS; r++)
        for (let c = 0; c < BS; c++)
            if (board3[r][c] && board3[r][c][0] === color) board3[r][c] = null;
    document.getElementById(`card-${color}`)?.classList.add('eliminated');
    document.getElementById(`status-${color}`).textContent = '💀 Eliminado';
}

// =========================================================================
// TURN MANAGEMENT
// =========================================================================

function currentColor3() { return activePlayers[turnIndex]; }

function advanceTurn3() {
    // Skip eliminated and inactive players
    let attempts = 0;
    const total = activePlayers.length;
    do {
        turnIndex = (turnIndex + 1) % total;
        attempts++;
    } while (eliminated.includes(currentColor3()) && attempts < total + 1);
}

function scheduleAITurn3() {
    if (isOver3 || isPaused3 || pendingPromo3) return;
    const color = currentColor3();
    if (cfg3[color] === 'ai') {
        statusEl3.textContent = `IA (${PLAYER_NAMES[color]}) pensando...`;
        setTimeout(() => {
            if (isOver3 || isPaused3) return;
            const move = getAIMove3(color);
            if (move) {
                executeMove3(move.from, move.to);
            } else {
                // No moves → stalemate, skip turn
                advanceTurn3();
                renderStatus3();
                scheduleAITurn3();
            }
        }, 600);
    }
}

// =========================================================================
// AI — Simple depth-1 evaluator
// =========================================================================

function evaluateFor3(color, b) {
    let score = 0;
    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            const p = b[r][c];
            if (!p) continue;
            const val = PIECE_VALUES[p[1]] || 0;
            if (p[0] === color) score += val;
            else score -= val * 0.5; // Penalize each enemy equally
        }
    }
    return score;
}

function getAIMove3(color) {
    const allMoves = [];
    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            if (board3[r][c] && board3[r][c][0] === color) {
                const moves = getLegalMoves3(r, c, board3);
                moves.forEach(to => allMoves.push({ from:{r,c}, to }));
            }
        }
    }
    if (!allMoves.length) return null;

    // Score each move
    let best = null, bestScore = -Infinity;
    for (const m of allMoves) {
        const piece = board3[m.from.r][m.from.c];
        const captured = applyMoveSim3(board3, m.from, m.to);
        const score = evaluateFor3(color, board3) + Math.random() * 2; // slight randomness
        undoMoveSim3(board3, m.from, m.to, captured, piece);
        if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
}

// =========================================================================
// HUMAN INTERACTION
// =========================================================================

function handleSquareClick3(r, c) {
    if (isOver3 || isPaused3 || pendingPromo3) return;
    const color = currentColor3();
    if (cfg3[color] !== 'human') return; // AI's turn

    const piece = board3[r][c];

    if (selectedSq) {
        const mv = legalMoves3.find(m => m.r === r && m.c === c);
        if (mv) {
            const movingPiece = board3[selectedSq.r][selectedSq.c];
            // Check promotion
            if (movingPiece[1] === 'p' && needsPromotion3(movingPiece, mv.r, mv.c)) {
                pendingPromo3 = { from: selectedSq, to: mv };
                showPromotionModal3(movingPiece[0]);
                selectedSq = null; legalMoves3 = [];
                return;
            }
            executeMove3(selectedSq, mv);
            selectedSq = null; legalMoves3 = [];
            return;
        }
    }

    if (piece && piece[0] === color) {
        if (selectedSq && selectedSq.r === r && selectedSq.c === c) {
            selectedSq = null; legalMoves3 = [];
        } else {
            selectedSq = {r, c};
            legalMoves3 = getLegalMoves3(r, c, board3);
        }
        renderBoard3();
    } else {
        selectedSq = null; legalMoves3 = [];
        renderBoard3();
    }
}

// =========================================================================
// PROMOTION MODAL
// =========================================================================

function showPromotionModal3(color) {
    const optionsEl = document.getElementById('promotion-options3');
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
            executeMove3(from, to, type);
        };
        optionsEl.appendChild(btn);
    });
    bsPromoModal.show();
}

// =========================================================================
// RENDERING
// =========================================================================

function renderBoard3() {
    boardEl3.innerHTML = '';

    // Which kings are in check?
    const inCheck = {};
    PLAYERS.filter(p => !eliminated.includes(p)).forEach(p => {
        inCheck[p] = isInCheck3(p, board3);
    });

    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            const sq = document.createElement('div');
            sq.classList.add('square3');

            if (!isValid3(r, c)) {
                sq.classList.add('invalid3');
            } else {
                sq.classList.add((r + c) % 2 === 0 ? 'light3' : 'dark3');

                // Last move highlight
                if (lastMove3 && ((lastMove3.from.r === r && lastMove3.from.c === c) || (lastMove3.to.r === r && lastMove3.to.c === c)))
                    sq.classList.add('sq-lastmove');

                // Selected
                if (selectedSq && selectedSq.r === r && selectedSq.c === c)
                    sq.classList.add('sq-selected');

                // Valid moves
                if (legalMoves3.some(m => m.r === r && m.c === c)) {
                    sq.classList.add('sq-valid');
                    const dot = document.createElement('div');
                    dot.className = 'valid-dot3';
                    sq.appendChild(dot);
                }

                // Render piece
                const piece = board3[r][c];
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece3 ${piece[0]}-piece`;
                    pieceEl.textContent = PIECE_ICONS[piece[1]];

                    // Check highlight on king
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
    if (isOver3) return;
    const color = currentColor3();
    const name = PLAYER_NAMES[color];
    const check = isInCheck3(color, board3);
    statusEl3.textContent = `Turno de las ${name}${check ? ' — ¡JAQUE!' : ''}`;

    // Update player cards
    activePlayers.forEach(p => {
        const card = document.getElementById(`card-${p}`);
        const st   = document.getElementById(`status-${p}`);
        const typeEl = document.getElementById(`type-${p}`);
        if (!card || !st) return;
        if (eliminated.includes(p)) return;

        // Mostrar puntos en el badge de tipo
        const pts = scores3[p] || 0;
        if (typeEl) {
            typeEl.textContent = `${cfg3[p] === 'ai' ? '🤖 IA' : '👤 H'} — ${pts} pts`;
            typeEl.className = `badge ${cfg3[p] === 'ai' ? 'bg-danger' : 'bg-primary'}`;
            typeEl.style.fontSize = '0.65rem';
        }

        if (p === color) {
            card.classList.add('active-turn');
            st.textContent = cfg3[p] === 'ai' ? '🤖 IA' : '🎮 Tu turno';
        } else {
            card.classList.remove('active-turn');
            st.textContent = cfg3[p] === 'ai' ? '🤖 IA' : '⏳ Esperando';
        }
    });
}

function renderHistory3() {
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

// =========================================================================
// TIMER
// =========================================================================

function formatTime3(s) {
    const m = Math.floor(s/60), sec = s%60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
}

function startTimer3() {
    clearInterval(timer3);
    timer3 = setInterval(() => {
        if (isPaused3 || isOver3) return;
        timeLeft3--;
        timerEl3.textContent = `⏱️ ${formatTime3(timeLeft3)}`;
        if (timeLeft3 <= 0) {
            isOver3 = true;
            clearInterval(timer3);
            endGame3(null, true);
        }
    }, 1000);
}

// =========================================================================
// GAME OVER
// =========================================================================

function endGame3(winner, timeout = false) {
    playSound3('gameEnd');
    isOver3 = true;
    clearInterval(timer3);
    const msg = document.getElementById('game-over-msg3');
    if (timeout) {
        msg.textContent = '⏱️ ¡Tiempo agotado! La partida terminó en empate.';
    } else if (winner) {
        msg.textContent = `🏆 ¡Ganan las ${PLAYER_NAMES[winner]}!`;
    }
    statusEl3.textContent = '¡Partida terminada!';
    bsGameOverModal.show();
}

// =========================================================================
// SOUND
// =========================================================================

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

// =========================================================================
// THEME
// =========================================================================

function applyTheme3(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.body.className = theme === 'dark' ? 'bg-dark' : 'bg-body';
    localStorage.setItem('ajedrezTheme', theme);
}

// =========================================================================
// INIT
// =========================================================================

function initGame3() {
    document.addEventListener('click', initAudio3, { once: true });

    // Bootstrap modals
    bsConfigModal  = new bootstrap.Modal(document.getElementById('configModal3'));
    bsRulesModal   = new bootstrap.Modal(document.getElementById('rulesModal3'));
    bsGameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal3'));
    bsPromoModal   = new bootstrap.Modal(document.getElementById('promotionModal3'));

    // Preset buttons (3 players)
    document.getElementById('preset-3h').addEventListener('click',    () => applyPreset('human','human','human'));
    document.getElementById('preset-3ai').addEventListener('click',   () => applyPreset('ai','ai','ai'));
    document.getElementById('preset-1h2ai').addEventListener('click', () => applyPreset('human','ai','ai'));
    document.getElementById('preset-2h1ai').addEventListener('click', () => applyPreset('human','human','ai'));
    // Preset buttons (4 players)
    document.getElementById('preset-4h').addEventListener('click',    () => { document.getElementById('cfg-include-g').checked = true; applyPreset('human','human','human','human'); });
    document.getElementById('preset-4ai').addEventListener('click',   () => { document.getElementById('cfg-include-g').checked = true; applyPreset('ai','ai','ai','ai'); });
    document.getElementById('preset-2h2ai').addEventListener('click', () => { document.getElementById('cfg-include-g').checked = true; applyPreset('human','human','ai','ai'); });
    document.getElementById('preset-1h3ai').addEventListener('click', () => { document.getElementById('cfg-include-g').checked = true; applyPreset('human','ai','ai','ai'); });

    document.getElementById('confirm-config3-btn').addEventListener('click', () => {
        // Read individual selectors
        cfg3.w = document.getElementById('cfg-w').value;
        cfg3.b = document.getElementById('cfg-b').value;
        cfg3.r = document.getElementById('cfg-r').value;
        cfg3.g = document.getElementById('cfg-g').value;
        
        // Read time
        const timeVal = parseInt(document.getElementById('cfg-time').value);
        totalTime3 = timeVal * 60;
        timeLeft3  = totalTime3;

        // Set active players (4-player if green is included)
        const include4 = document.getElementById('cfg-include-g').checked;
        activePlayers = include4 ? ['w','b','r','g'] : ['w','b','r'];

        // Show/hide green card
        const cardG = document.getElementById('card-g');
        if (cardG) cardG.style.display = include4 ? '' : 'none';

        localStorage.setItem('ajedrezConfig3', JSON.stringify({ cfg3, activePlayers, totalTime3 }));

        // ⚠️ IMPORTANTE: reconstruir el tablero DESPUÉS de fijar activePlayers
        // para que las piezas verdes aparezcan si el 4to jugador fue activado.
        resetGame3(false);

        bsConfigModal.hide();
        bsRulesModal.show();
    });

    const saved = localStorage.getItem('ajedrezTheme');
    applyTheme3(saved || 'light');

    resetGame3(false);
    bsConfigModal.show(); // Show config modal first
}

function applyPreset(w, b, r, g = 'ai') {
    document.getElementById('cfg-w').value = w;
    document.getElementById('cfg-b').value = b;
    document.getElementById('cfg-r').value = r;
    document.getElementById('cfg-g').value = g;
}

function resetGame3(startTimer = true) {
    board3      = buildInitialBoard3();
    turnIndex   = 0;
    eliminated  = [];
    selectedSq  = null;
    legalMoves3 = [];
    lastMove3   = null;
    isOver3     = false;
    isPaused3   = false;
    pendingPromo3 = null;
    moveHistory3  = [];
    scores3       = { w:0, b:0, r:0, g:0 };
    timeLeft3     = totalTime3;
    clearInterval(timer3);

    // Reset player card UI
    PLAYERS.forEach(p => {
        document.getElementById(`card-${p}`)?.classList.remove('eliminated','active-turn');
        document.getElementById(`status-${p}`).textContent = 'Esperando...';
        // Show Human/AI badge
        const typeEl = document.getElementById(`type-${p}`);
        if (typeEl) {
            typeEl.textContent = cfg3[p] === 'ai' ? '🤖 IA' : '👤 Humano';
            typeEl.className = `badge ${cfg3[p] === 'ai' ? 'bg-danger' : 'bg-primary'}`;
            typeEl.style.fontSize = '0.65rem';
        }
    });

    renderBoard3();
    renderStatus3();
    historyEl3.innerHTML = '';
    timerEl3.textContent = `⏱️ ${formatTime3(timeLeft3)}`;

    if (startTimer) {
        startTimer3();
        scheduleAITurn3();
    }
}

// =========================================================================
// EVENT LISTENERS
// =========================================================================

document.getElementById('start-game3-btn').addEventListener('click', () => {
    bsRulesModal.hide();
    startTimer3();
    renderStatus3();
    scheduleAITurn3();
});

document.getElementById('restart-btn3').addEventListener('click', () => {
    if (confirm('¿Reiniciar la partida? Volverás a la configuración.')) {
        resetGame3(false);
        bsConfigModal.show();
    }
});

document.getElementById('play-again3-btn').addEventListener('click', () => {
    bsGameOverModal.hide();
    resetGame3(false);
    bsConfigModal.show();
});

document.getElementById('theme-toggle3').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-bs-theme');
    applyTheme3(cur === 'dark' ? 'light' : 'dark');
});

// Start!
initGame3();
