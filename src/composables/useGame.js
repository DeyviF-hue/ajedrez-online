import { ref, computed } from 'vue';
import { INITIAL_BOARD, getLegalMoves, isInCheck, hasAnyLegalMoves } from '../logic/gameLogic';

export function useGame() {
    const board = ref(JSON.parse(JSON.stringify(INITIAL_BOARD)));
    const currentTurn = ref('w');
    const selectedSquare = ref(null);
    const validMoves = ref([]);
    const isGameOver = ref(false);
    const moveHistory = ref([]);
    
    // Status message computed
    const statusMessage = computed(() => {
        if (isGameOver.value) {
            const check = isInCheck(currentTurn.value, board.value);
            return check ? '¡Jaque Mate!' : 'Tablas';
        }
        const colorName = currentTurn.value === 'w' ? 'Blancas' : 'Negras';
        const check = isInCheck(currentTurn.value, board.value);
        return `Turno de las ${colorName}${check ? ' - ¡JAQUE!' : ''}`;
    });

    const isCheck = computed(() => {
        return {
            w: isInCheck('w', board.value),
            b: isInCheck('b', board.value)
        };
    });

    const handleSquareClick = (r, c) => {
        if (isGameOver.value) return;

        const piece = board.value[r][c];

        // Mover si hay una casilla seleccionada
        if (selectedSquare.value) {
            const move = validMoves.value.find(m => m.r === r && m.c === c);
            if (move) {
                executeMove(selectedSquare.value, move);
                selectedSquare.value = null;
                validMoves.value = [];
                return;
            }
        }

        // Seleccionar pieza propia
        if (piece && piece[0] === currentTurn.value) {
            if (selectedSquare.value && selectedSquare.value.r === r && selectedSquare.value.c === c) {
                selectedSquare.value = null;
                validMoves.value = [];
            } else {
                selectedSquare.value = { r, c };
                validMoves.value = getLegalMoves(r, c, board.value);
            }
        } else {
            selectedSquare.value = null;
            validMoves.value = [];
        }
    };

    const executeMove = (from, to) => {
        const piece = board.value[from.r][from.c];
        
        // Efectuar el movimiento
        board.value[to.r][to.c] = piece;
        board.value[from.r][from.c] = null;
        
        // Promoción a Reina por defecto (para simplificar en este boilerplate)
        if (piece[1] === 'p' && (to.r === 0 || to.r === 7)) {
            board.value[to.r][to.c] = piece[0] + 'q';
        }

        // Registrar Historial
        const files = ['a','b','c','d','e','f','g','h'];
        const ranks = ['8','7','6','5','4','3','2','1'];
        moveHistory.value.push(`${piece[1].toUpperCase()}${files[to.c]}${ranks[to.r]}`);

        // Cambiar turno
        currentTurn.value = currentTurn.value === 'w' ? 'b' : 'w';

        // Comprobar Fin de Juego
        if (!hasAnyLegalMoves(currentTurn.value, board.value)) {
            isGameOver.value = true;
        }
    };

    const resetGame = () => {
        board.value = JSON.parse(JSON.stringify(INITIAL_BOARD));
        currentTurn.value = 'w';
        selectedSquare.value = null;
        validMoves.value = [];
        isGameOver.value = false;
        moveHistory.value = [];
    };

    return {
        board,
        currentTurn,
        selectedSquare,
        validMoves,
        isGameOver,
        statusMessage,
        isCheck,
        moveHistory,
        handleSquareClick,
        resetGame
    };
}
