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
// Fomentan el desarrollo hacia el centro y posiciones estratégicas
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

/**
 * Evalúa el tablero desde la perspectiva de las blancas.
 * Un valor positivo significa ventaja para las blancas, negativo para las negras.
 */
export function evaluateBoard(board) {
    let score = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            
            const color = piece[0];
            const type = piece[1];
            
            // Valor material base
            let val = PIECE_VALUES[type];
            
            // Valor posicional
            if (type === 'p') {
                const rank = color === 'w' ? r : 7 - r;
                val += PAWN_PST_WHITE[rank][c];
            } else if (type === 'n') {
                val += KNIGHT_PST[r][c];
            } else if (type === 'b') {
                val += BISHOP_PST[r][c];
            }
            
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
            // Penalización muy alta si es mate, ajustada por la profundidad
            // para preferir mates más rápidos
            return isMaximizing ? -99999 + depth : 99999 - depth;
        }
        return 0; // Ahogado (Empate)
    }

    // Move Ordering básico: probar capturas primero mejora enormemente el pruning
    moves.sort((m1, m2) => {
        const t1 = board[m1.to.r][m1.to.c];
        const t2 = board[m2.to.r][m2.to.c];
        const val1 = t1 ? PIECE_VALUES[t1[1]] : 0;
        const val2 = t2 ? PIECE_VALUES[t2[1]] : 0;
        return val2 - val1;
    });

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
 * @returns {Object} - { move: {from, to}, score: Number }
 */
export function getBestMove(board, depth, color) {
    const isMaximizing = color === 'w';
    const moves = getAllLegalMoves(color, board);
    
    if (moves.length === 0) return null;

    // Move Ordering principal
    moves.sort((m1, m2) => {
        const t1 = board[m1.to.r][m1.to.c];
        const t2 = board[m2.to.r][m2.to.c];
        const val1 = t1 ? PIECE_VALUES[t1[1]] : 0;
        const val2 = t2 ? PIECE_VALUES[t2[1]] : 0;
        return val2 - val1;
    });

    let bestMove = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    const nextColor = color === 'w' ? 'b' : 'w';

    for (const move of moves) {
        const simData = applyMoveSim(board, move);
        const score = minimax(board, depth - 1, alpha, beta, !isMaximizing, nextColor);
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
