<template>
    <!-- ===== NAVBAR ===== -->
    <nav class="navbar navbar-expand navbar-dark bg-dark shadow-sm py-1">
        <div class="container-fluid px-2 px-md-4">
            <a class="navbar-brand fw-bold fs-6 m-0" href="/menu.html">♟️ Ajedrez Pro</a>
            <div class="d-flex align-items-center gap-2">
                <button id="theme-toggle" class="btn btn-outline-secondary btn-sm border-0" title="Cambiar Tema">🌓</button>
                <button id="restart-btn" class="btn btn-warning btn-sm fw-bold px-3 rounded-pill shadow-sm">Reiniciar</button>
                <a href="/menu.html" class="btn btn-danger btn-sm fw-bold px-3 rounded-pill shadow-sm">Salir</a>
            </div>
        </div>
    </nav>

    <!-- ===== LAYOUT ===== -->
    <div class="container-fluid mt-3 px-2 px-md-4 mb-4">
        <div class="d-flex flex-column flex-xl-row gap-3 justify-content-center align-items-center align-items-xl-start">
            
            <!-- Columna tablero -->
            <div class="d-flex flex-column align-items-center w-100" style="max-width: 620px;">

                <!-- Piezas capturadas Negras -->
                <div class="d-flex justify-content-between align-items-end w-100 mb-2 px-1">
                    <div class="captured-pieces" id="captured-black"></div>
                    <div id="global-timer" class="badge bg-dark fs-6 px-3 py-2 shadow-sm rounded-pill border border-secondary">⏱️ 10:00</div>
                </div>

                <!-- Tablero + barra evaluación -->
                <div class="d-flex align-items-stretch justify-content-center w-100 gap-2">
                    <div class="eval-container shadow-sm">
                        <div id="eval-bar-fill" class="eval-bar-fill" style="height:50%"></div>
                        <span id="eval-text" class="eval-text fw-bold">0.0</span>
                    </div>
                    <div class="board-container shadow-lg">
                        <!-- script.js construye el tablero aquí -->
                        <div id="chessboard" class="chessboard"></div>
                    </div>
                </div>

                <!-- Piezas capturadas Blancas + estado -->
                <div class="d-flex justify-content-between align-items-center w-100 mt-2 px-1">
                    <div class="captured-pieces" id="captured-white"></div>
                    <h6 id="status-display" class="mb-0 fw-bold bg-primary text-white px-3 py-2 rounded-pill shadow-sm" style="font-size:0.9rem;">Cargando...</h6>
                </div>
            </div>

            <!-- Columna panel lateral -->
            <div class="w-100 mt-2 mt-xl-0" style="max-width:620px; flex:1 1 350px;">
                <div class="card shadow-sm border-0 h-100 bg-body-tertiary">
                    <div class="card-body d-flex flex-column gap-3 p-3">
                        <div class="d-flex gap-2">
                            <button id="pause-btn" class="btn btn-warning fw-bold flex-grow-1 rounded-pill shadow-sm">⏸️ Pausar</button>
                            <button id="suggest-btn" class="btn btn-info text-white fw-bold px-4 rounded-pill shadow-sm">💡 Sugerir</button>
                        </div>
                        <div class="d-flex flex-column flex-grow-1 bg-body rounded-3 shadow-sm border p-2">
                            <h6 class="fw-bold text-muted text-uppercase small mb-2 px-1 border-bottom pb-2">Historial de Movimientos</h6>
                            <div id="move-history" class="move-history flex-grow-1 px-1"></div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <!-- ===== MODALES ===== -->
    <div class="modal fade" id="gameOverModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content shadow-lg border-0 rounded-4">
                <div class="modal-header bg-primary text-white border-0 rounded-top-4">
                    <h5 class="modal-title fw-bold" id="game-over-title">Fin de la Partida</h5>
                </div>
                <div class="modal-body text-center py-4">
                    <h4 id="game-over-message" class="mb-0 fw-bold">¡Ganan las Blancas!</h4>
                </div>
                <div class="modal-footer border-0 justify-content-center bg-light rounded-bottom-4">
                    <a href="/menu" class="btn btn-outline-secondary fw-bold rounded-pill">Ir al Menú</a>
                    <button type="button" class="btn btn-primary fw-bold rounded-pill px-4" id="modal-restart-btn">Jugar de Nuevo</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="restartModal" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-body text-center py-4">
                    <h5 class="mb-3 fw-bold">¿Reiniciar Partida?</h5>
                    <p class="text-muted small">Se perderá tu progreso actual.</p>
                    <div class="d-flex gap-2 justify-content-center mt-4">
                        <button type="button" class="btn btn-light fw-bold rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger fw-bold rounded-pill px-4" id="confirm-restart-btn">Reiniciar</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="promotionModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div class="modal-header bg-dark text-white border-0 py-2">
                    <h6 class="modal-title m-0 fw-bold">Promoción de Peón</h6>
                </div>
                <div class="modal-body text-center bg-body-tertiary py-4">
                    <p class="small text-muted mb-3 fw-bold">Elige tu nueva pieza:</p>
                    <div class="d-flex justify-content-center gap-3" id="promotion-options"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import './assets/styles.css';
</script>

