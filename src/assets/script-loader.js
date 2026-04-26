// Wrapper que ejecuta el script.js original DESPUÉS de que el DOM esté listo.
// Se importa desde App.vue en onMounted() para garantizar que todos los getElementById funcionen.

// Reexportar la función de inicio del script original
export function initChessApp() {
    // Toda la lógica original está en window.initGame() porque script.js
    // la expone al importarse como módulo clásico via <script>.
    // Aquí simplemente la invocamos si ya fue cargada.
    if (typeof window._chessInit === 'function') {
        window._chessInit();
    }
}
