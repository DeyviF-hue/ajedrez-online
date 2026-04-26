export const PIECES = {
    w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export const INITIAL_BOARD = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

export function getPseudoLegalMoves(r, c, b) {
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

export function isInCheck(color, b) {
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

export function applyMoveSim(b, move) {
    const piece = b[move.from.r][move.from.c];
    const targetPiece = b[move.to.r][move.to.c];
    b[move.to.r][move.to.c] = piece;
    b[move.from.r][move.from.c] = null;
    let promoted = false;
    if (piece[1] === 'p' && (move.to.r === 0 || move.to.r === 7)) {
        b[move.to.r][move.to.c] = piece[0] + 'q'; // Default to queen for simulation
        promoted = true;
    }
    return { piece, targetPiece, promoted };
}

export function undoMoveSim(b, move, simData) {
    b[move.from.r][move.from.c] = simData.piece;
    b[move.to.r][move.to.c] = simData.targetPiece;
}

export function getLegalMoves(r, c, b) {
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

export function hasAnyLegalMoves(color, b) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] && b[r][c][0] === color) {
                if (getLegalMoves(r, c, b).length > 0) return true;
            }
        }
    }
    return false;
}

export function getAllLegalMoves(color, b) {
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
