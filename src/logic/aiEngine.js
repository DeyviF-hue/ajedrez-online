import { getAllLegalMoves, applyMoveSim, undoMoveSim, isInCheck } from './gameLogic.js';

// Valores base de las piezas (multiplicados por 10 para mayor precisión)
const PIECE_VALUES = {
    p: 10,
    n: 30,
    b: 30,
    r: 50,
    q: 90,
    k: 900
};

// Tablas de posicionamiento (Piece-Square Tables)
const PAWN_PST_WHITE = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5,  5,  5,  5,  5,  5,  5,  5],
    [ 1,  1,  2,  3,  3,  2,  1,  1],
    [ 0.5,0.5,1,  2.5,2.5,1,  0.5,0.5],
    [ 0,  0,  0,  2,  2,  0,  0,  0],
    [ 0.5,-0.5,-1,0,  0, -1, -0.5,0.5],
    [ 0.5, 1,  1, -2, -2, 1,  1,  0.5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
    [-5, -4, -3, -3, -3, -3, -4, -5],
    [-4, -2,  0,  0,  0,  0, -2, -4],
    [-3,  0,  1,  1.5,1.5,1,  0, -3],
    [-3,  0.5,1.5,2,  2,  1.5,0.5,-3],
    [-3,  0,  1.5,2,  2,  1.5,0, -3],
    [-3,  0.5,1,  1.5,1.5,1,  0.5,-3],
    [-4, -2,  0,  0.5,0.5,0, -2, -4],
    [-5, -4, -3, -3, -3, -3, -4, -5]
];

const BISHOP_PST = [
    [-2, -1, -1, -1, -1, -1, -1, -2],
    [-1,  0,  0,  0,  0,  0,  0, -1],
    [-1,  0,  0.5,1,  1,  0.5,0, -1],
    [-1,  0.5,0.5,1,  1,  0.5,0.5,-1],
    [-1,  0,  1,  1,  1,  1,  0, -1],
    [-1,  1,  1,  1,  1,  1,  1, -1],
    [-1,  0.5,0,  0,  0,  0,  0.5,-1],
    [-2, -1, -1, -1, -1, -1, -1, -2]
];

const ROOK_PST = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 0.5, 1,  1,  1,  1,  1,  1,  0.5],
    [-0.5, 0,  0,  0,  0,  0,  0, -0.5],
    [-0.5, 0,  0,  0,  0,  0,  0, -0.5],
    [-0.5, 0,  0,  0,  0,  0,  0, -0.5],
    [-0.5, 0,  0,  0,  0,  0,  0, -0.5],
    [-0.5, 0,  0,  0,  0,  0,  0, -0.5],
    [ 0,  0,  0,  0.5,0.5,0,  0,  0]
];

const QUEEN_PST = [
    [-2, -1, -1, -0.5,-0.5,-1, -1, -2],
    [-1,  0,  0,  0,  0,  0,  0, -1],
    [-1,  0,  0.5,0.5,0.5,0.5,0, -1],
    [-0.5,0,  0.5,0.5,0.5,0.5,0, -0.5],
    [ 0,  0,  0.5,0.5,0.5,0.5,0, -0.5],
    [-1,  0.5,0.5,0.5,0.5,0.5,0, -1],
    [-1,  0,  0.5,0,  0,  0,  0, -1],
    [-2, -1, -1, -0.5,-0.5,-1, -1, -2]
];

const KING_MIDDLE_PST = [
    [-3, -4, -4, -5, -5, -4, -4, -3],
    [-3, -4, -4, -5, -5, -4, -4, -3],
    [-3, -4, -4, -5, -5, -4, -4, -3],
    [-3, -4, -4, -5, -5, -4, -4, -3],
    [-2, -3, -3, -4, -4, -3, -3, -2],
    [-1, -2, -2, -2, -2, -2, -2, -1],
    [ 2,  2,  0,  0,  0,  0,  2,  2],
    [ 2,  3,  1,  0,  0,  1,  3,  2]
];

const KING_END_PST = [
    [-5, -4, -3, -2, -2, -3, -4, -5],
    [-3, -2, -1,  0,  0, -1, -2, -3],
    [-3, -1,  2,  3,  3,  2, -1, -3],
    [-3, -1,  3,  4,  4,  3, -1, -3],
    [-3, -1,  3,  4,  4,  3, -1, -3],
    [-3, -1,  2,  3,  3,  2, -1, -3],
    [-3, -3,  0,  0,  0,  0, -3, -3],
    [-5, -3, -3, -3, -3, -3, -3, -5]
];

function getPieceValue(piece) {
    return piece ? PIECE_VALUES[piece[1]] : 0;
}

/**
 * Ordenamiento heurístico MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
 */
function moveOrdering(m1, m2, board) {
    let score1 = 0;
    const piece1 = board[m1.from.r][m1.from.c];
    const victim1 = getPieceValue(board[m1.to.r][m1.to.c]);
    if (victim1) score1 = victim1 * 10 - getPieceValue(piece1);
    if (piece1 && piece1[1] === 'p' && (m1.to.r === 0 || m1.to.r === 7)) score1 += 900; // Fuerte incentivo a promocionar

    let score2 = 0;
    const piece2 = board[m2.from.r][m2.from.c];
    const victim2 = getPieceValue(board[m2.to.r][m2.to.c]);
    if (victim2) score2 = victim2 * 10 - getPieceValue(piece2);
    if (piece2 && piece2[1] === 'p' && (m2.to.r === 0 || m2.to.r === 7)) score2 += 900;

    return score2 - score1; // Descendente
}

/**
 * Evalúa el tablero desde la perspectiva de las blancas.
 * Un valor positivo significa ventaja para las blancas, negativo para las negras.
 */
export function evaluateBoard(board) {
    let score = 0;
    let nonPawnMaterial = 0;
    
    // Contar material para detectar fase del juego (Medio juego vs Final)
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            const type = piece[1];
            if (type !== 'p' && type !== 'k') {
                nonPawnMaterial += PIECE_VALUES[type];
            }
        }
    }
    
    // Si el material sin peones es menor a 150 (aprox. reina + torre menor), consideramos que es el final
    const isEndgame = nonPawnMaterial < 150;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            
            const color = piece[0];
            const type = piece[1];
            
            let val = PIECE_VALUES[type];
            
            // Valor posicional ajustado por color
            const rank = color === 'w' ? r : 7 - r;
            
            if (type === 'p') val += PAWN_PST_WHITE[rank][c];
            else if (type === 'n') val += KNIGHT_PST[rank][c];
            else if (type === 'b') val += BISHOP_PST[rank][c];
            else if (type === 'r') val += ROOK_PST[rank][c];
            else if (type === 'q') val += QUEEN_PST[rank][c];
            else if (type === 'k') val += isEndgame ? KING_END_PST[rank][c] : KING_MIDDLE_PST[rank][c];
            
            // Las blancas suman, las negras restan
            score += color === 'w' ? val : -val;
        }
    }
    
    return score;
}

/**
 * Algoritmo Minimax con poda Alpha-Beta.
 */
function minimax(board, depth, alpha, beta, isMaximizing, currentColor) {
    if (depth === 0) {
        return evaluateBoard(board);
    }

    const moves = getAllLegalMoves(currentColor, board);

    // Si no hay movimientos, es Jaque Mate o Ahogado
    if (moves.length === 0) {
        if (isInCheck(currentColor, board)) {
            return isMaximizing ? -99999 + depth : 99999 - depth;
        }
        return 0; // Ahogado (Empate)
    }

    moves.sort((m1, m2) => moveOrdering(m1, m2, board));

    const nextColor = currentColor === 'w' ? 'b' : 'w';

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const simData = applyMoveSim(board, move);
            const ev = minimax(board, depth - 1, alpha, beta, false, nextColor);
            undoMoveSim(board, move, simData);
            
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break; // Beta cutoff
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const simData = applyMoveSim(board, move);
            const ev = minimax(board, depth - 1, alpha, beta, true, nextColor);
            undoMoveSim(board, move, simData);
            
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break; // Alpha cutoff
        }
        return minEval;
    }
}

/**
 * Encuentra el mejor movimiento para un color dado usando Minimax.
 * @param {Array} board - El tablero 8x8.
 * @param {Number} depth - La profundidad de búsqueda (dificultad).
 * @param {String} color - 'w' o 'b'.
 * @param {Array} history - El historial de posiciones.
 * @returns {Object} - { move: {from, to}, score: Number }
 */
export function getBestMove(board, depth, color, history = []) {
    const isMaximizing = color === 'w';
    const moves = getAllLegalMoves(color, board);
    
    if (moves.length === 0) return null;

    moves.sort((m1, m2) => moveOrdering(m1, m2, board));

    let bestMove = moves[0]; // Por defecto el primero
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    const nextColor = color === 'w' ? 'b' : 'w';

    for (const move of moves) {
        const simData = applyMoveSim(board, move);
        
        // Anti-Bucles: Evitar posiciones que ya se han jugado
        const currentHash = JSON.stringify(board);
        const repetitions = history.filter(h => h === currentHash).length;
        
        let score = minimax(board, depth - 1, alpha, beta, !isMaximizing, nextColor);
        
        // Si repetiríamos el tablero, aplicar una enorme penalización para forzar alternativas
        if (repetitions > 0) {
            // Penalización masiva, a menos que estemos perdiendo y el empate sea mejor
            // Simplificado: penalizar fuertemente repetir posiciones
            if (isMaximizing) score -= 5000;
            else score += 5000;
        }

        undoMoveSim(board, move, simData);

        if (isMaximizing) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            alpha = Math.max(alpha, score);
        } else {
            if (score < bestScore) {
                bestScore = score;
                bestMove = move;
            }
            beta = Math.min(beta, score);
        }
    }

    return { move: bestMove, score: bestScore };
}

