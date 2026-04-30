export const BS = 14;
export const CS = 3;
export const PLAYERS = ['w', 'b', 'r', 'g'];
export const PIECE_VALUES = { p:10, n:30, b:30, r:50, q:90, k:900 };

export function isValid3(r, c) {
    if (r < 0 || r >= BS || c < 0 || c >= BS) return false;
    if (r < CS && c < CS) return false;
    if (r < CS && c >= BS - CS) return false;
    if (r >= BS - CS && c < CS) return false;
    if (r >= BS - CS && c >= BS - CS) return false;
    return true;
}

export function buildInitialBoard3(activePlayers = ['w', 'b', 'r']) {
    const b = Array.from({length: BS}, () => Array(BS).fill(null));
    const wBack = ['wr','wn','wb','wq','wk','wb','wn','wr'];
    for (let i = 0; i < 8; i++) { b[13][3+i] = wBack[i]; b[12][3+i] = 'wp'; }

    const bBack = ['br','bn','bb','bq','bk','bb','bn','br'];
    for (let i = 0; i < 8; i++) { b[0][3+i] = bBack[i]; b[1][3+i] = 'bp'; }

    const rBack = ['rr','rn','rb','rq','rk','rb','rn','rr'];
    for (let i = 0; i < 8; i++) { b[3+i][13] = rBack[i]; b[3+i][12] = 'rp'; }

    if (activePlayers.includes('g')) {
        const gBack = ['gr','gn','gb','gq','gk','gb','gn','gr'];
        for (let i = 0; i < 8; i++) { b[3+i][0] = gBack[i]; b[3+i][1] = 'gp'; }
    }
    return b;
}

export function getPawnMoves3(r, c, b) {
    const color = b[r][c][0];
    const moves = [];
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
    } else {
        dr=0; dc=1; startR=null; startC=1;
        capDirs=[[-1,1],[1,1]];
    }

    const nr = r + dr, nc = c + dc;
    if (isValid3(nr, nc) && !b[nr][nc]) {
        moves.push({r:nr, c:nc});
        const isStart = (color==='w' && r===startR) || (color==='b' && r===startR)
                      || (color==='r' && c===startC) || (color==='g' && c===startC);
        const nr2 = r + 2*dr, nc2 = c + 2*dc;
        if (isStart && isValid3(nr2, nc2) && !b[nr2][nc2]) moves.push({r:nr2, c:nc2});
    }

    for (const [dro, dco] of capDirs) {
        const cr = r + dro, cc = c + dco;
        if (isValid3(cr, cc) && b[cr][cc] && b[cr][cc][0] !== color) moves.push({r:cr, c:cc});
    }
    return moves;
}

export function getPseudoMoves3(r, c, b) {
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

export function findKing3(color, b) {
    for (let r = 0; r < BS; r++)
        for (let c = 0; c < BS; c++)
            if (b[r][c] === color + 'k') return {r, c};
    return null;
}

export function isInCheck3(color, b, eliminated) {
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

export function applyMoveSim3(b, from, to) {
    const piece = b[from.r][from.c];
    const captured = b[to.r][to.c];
    b[to.r][to.c] = piece;
    b[from.r][from.c] = null;
    return captured;
}

export function undoMoveSim3(b, from, to, captured, origPiece) {
    b[from.r][from.c] = origPiece;
    b[to.r][to.c] = captured;
}

export function getLegalMoves3(r, c, b, eliminated) {
    const color = b[r][c][0];
    return getPseudoMoves3(r, c, b).filter(to => {
        const piece = b[r][c];
        const captured = applyMoveSim3(b, {r, c}, to);
        const inCheck = isInCheck3(color, b, eliminated);
        undoMoveSim3(b, {r, c}, to, captured, piece);
        return !inCheck;
    });
}

export function hasLegalMoves3(color, b, eliminated) {
    for (let r = 0; r < BS; r++)
        for (let c = 0; c < BS; c++)
            if (b[r][c] && b[r][c][0] === color)
                if (getLegalMoves3(r, c, b, eliminated).length > 0) return true;
    return false;
}

export function needsPromotion3(piece, r, c) {
    if (!piece || piece[1] !== 'p') return false;
    if (piece[0] === 'w' && r === 0)        return true;
    if (piece[0] === 'b' && r === BS - 1)   return true;
    if (piece[0] === 'r' && c === 0)        return true;
    if (piece[0] === 'g' && c === BS - 1)   return true;
    return false;
}

// AI LOGIC
export const AI_STYLES = {
    w: 'oportunista',
    b: 'agresivo',
    r: 'defensivo',
    g: 'oportunista'
};

export function getNextActivePlayer(currentColor, activePlayers, eliminated) {
    let idx = activePlayers.indexOf(currentColor);
    let attempts = 0;
    do {
        idx = (idx + 1) % activePlayers.length;
        attempts++;
    } while (eliminated.includes(activePlayers[idx]) && attempts < activePlayers.length);
    return activePlayers[idx];
}

export function evaluateFor3(color, b, style, activePlayers, eliminated) {
    let myMat = 0;
    let enemyMatTotal = 0;
    let enemyCount = 0;
    let kingRisk = 0;
    let attackOpp = 0;

    const myKing = findKing3(color, b);

    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            const p = b[r][c];
            if (!p) continue;
            
            const val = PIECE_VALUES[p[1]] || 0;
            const isMe = p[0] === color;
            const isEnemy = !isMe && !eliminated.includes(p[0]);

            if (isMe) {
                myMat += val;
                const distCenter = Math.abs(r - 6.5) + Math.abs(c - 6.5);
                myMat -= distCenter * 0.5;
            } else if (isEnemy) {
                enemyMatTotal += val;
                if (style === 'agresivo' && p[1] === 'k' && myKing) {
                    const distToEnemyKing = Math.abs(r - myKing.r) + Math.abs(c - myKing.c);
                    attackOpp += (30 - distToEnemyKing);
                }
            }

            if (isEnemy && myKing) {
                const distToKing = Math.abs(r - myKing.r) + Math.abs(c - myKing.c);
                if (distToKing <= 2) {
                    kingRisk += val * 0.1;
                }
            }
        }
    }

    enemyCount = activePlayers.filter(p => p !== color && !eliminated.includes(p)).length;
    const avgEnemyMat = enemyCount > 0 ? (enemyMatTotal / enemyCount) : 0;

    if (isInCheck3(color, b, eliminated)) kingRisk += 500;

    let multMat = 1.5;
    let multRisk = 2.0;
    let multOpp = 1.0;

    if (style === 'defensivo') {
        multRisk = 4.0;
        multOpp = 0.5;
    } else if (style === 'agresivo') {
        multRisk = 1.0;
        multOpp = 2.0;
    } else if (style === 'oportunista') {
        multMat = 2.0;
        multRisk = 2.5;
    }

    return (myMat * multMat) - avgEnemyMat - (kingRisk * multRisk) + (attackOpp * multOpp);
}

export function moveOrdering3(m1, m2, b) {
    const p1 = b[m1.to.r][m1.to.c];
    const p2 = b[m2.to.r][m2.to.c];
    const val1 = p1 ? PIECE_VALUES[p1[1]] || 0 : 0;
    const val2 = p2 ? PIECE_VALUES[p2[1]] || 0 : 0;
    return val2 - val1;
}

export function getAIMove3(color, b, activePlayers, eliminated, moveHistory3) {
    const allMoves = [];
    for (let r = 0; r < BS; r++) {
        for (let c = 0; c < BS; c++) {
            if (b[r][c] && b[r][c][0] === color) {
                const moves = getLegalMoves3(r, c, b, eliminated);
                moves.forEach(to => allMoves.push({ from:{r,c}, to }));
            }
        }
    }
    if (!allMoves.length) return null;

    allMoves.sort((m1, m2) => moveOrdering3(m1, m2, b));

    const style = AI_STYLES[color] || 'oportunista';
    const nextPlayer = getNextActivePlayer(color, activePlayers, eliminated);

    let bestMove = allMoves[0];
    let bestScore = -Infinity;

    for (const m of allMoves) {
        const piece = b[m.from.r][m.from.c];
        const captured = applyMoveSim3(b, m.from, m.to);
        
        let score = evaluateFor3(color, b, style, activePlayers, eliminated);

        const currentHash = JSON.stringify(b);
        const reps = moveHistory3.filter(hist => hist.hash === currentHash).length;
        if (reps > 0) score -= 5000;

        if (nextPlayer && nextPlayer !== color && !eliminated.includes(nextPlayer)) {
            let worstCaseForMe = Infinity;
            const enemyMoves = [];
            for (let er = 0; er < BS; er++) {
                for (let ec = 0; ec < BS; ec++) {
                    if (b[er][ec] && b[er][ec][0] === nextPlayer) {
                        const ems = getLegalMoves3(er, ec, b, eliminated);
                        for (const eto of ems) {
                            const tgt = b[eto.r][eto.c];
                            if (tgt && tgt[0] === color) { 
                                enemyMoves.push({ from: {r:er, c:ec}, to: eto });
                            }
                        }
                    }
                }
            }

            if (enemyMoves.length > 0) {
                for (const em of enemyMoves) {
                    const ePiece = b[em.from.r][em.from.c];
                    const eCaptured = applyMoveSim3(b, em.from, em.to);
                    
                    const eScore = evaluateFor3(color, b, style, activePlayers, eliminated);
                    if (eScore < worstCaseForMe) worstCaseForMe = eScore;

                    undoMoveSim3(b, em.from, em.to, eCaptured, ePiece);
                }
                score = (score + worstCaseForMe) / 2;
            }
        }

        score += Math.random() * 2;

        undoMoveSim3(b, m.from, m.to, captured, piece);

        if (score > bestScore) { 
            bestScore = score; 
            bestMove = m; 
        }
    }
    return bestMove;
}
