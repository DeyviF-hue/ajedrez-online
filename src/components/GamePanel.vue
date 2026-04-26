<template>
  <div class="card shadow-sm border-0 h-100 bg-body-tertiary">
      <div class="card-body d-flex flex-column gap-3 p-3">
          <div class="d-flex gap-2">
              <button class="btn btn-warning fw-bold flex-grow-1 rounded-pill shadow-sm" @click="$emit('reset')">
                  ⏸️ Pausar
              </button>
              <button class="btn btn-info text-white fw-bold px-4 rounded-pill shadow-sm" title="Sugerir Jugada">
                  💡 Sugerir
              </button>
          </div>
          
          <div class="d-flex flex-column flex-grow-1 bg-body rounded-3 shadow-sm border p-2">
              <h6 class="fw-bold text-muted text-uppercase small mb-2 px-1 border-bottom pb-2">Historial de Movimientos</h6>
              <div class="move-history flex-grow-1 px-1">
                  <div v-if="moveHistory.length === 0" class="text-muted small text-center mt-2">Sin movimientos</div>
                  <div v-for="(move, i) in moveHistory" :key="i" class="move-item">
                      <span class="move-number">{{ Math.floor(i/2) + 1 }}.</span> {{ move }}
                  </div>
              </div>
          </div>
      </div>
  </div>
</template>

<script setup>
defineProps({
  moveHistory: Array
});

defineEmits(['reset']);
</script>
