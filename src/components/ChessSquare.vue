<template>
  <div 
    class="square" 
    :class="{ 
      'dark': isDark, 
      'light': !isDark, 
      'selected': isSelected,
      'check': isCheck
    }"
    @click="$emit('square-click')"
  >
    <!-- Pieza -->
    <div v-if="piece" class="piece" :class="pieceColorClass">
      {{ pieceIcon }}
    </div>
    
    <!-- Indicador de movimiento -->
    <div v-if="isValidMove" class="valid-move-indicator"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { PIECES } from '../logic/gameLogic';

const props = defineProps({
  piece: String,
  isDark: Boolean,
  isSelected: Boolean,
  isValidMove: Boolean,
  isCheck: Boolean
});

defineEmits(['square-click']);

const pieceColorClass = computed(() => {
  if (!props.piece) return '';
  return props.piece[0] === 'w' ? 'white-piece' : 'black-piece';
});

const pieceIcon = computed(() => {
  if (!props.piece) return '';
  const color = props.piece[0];
  const type = props.piece[1];
  return PIECES[color][type];
});
</script>
