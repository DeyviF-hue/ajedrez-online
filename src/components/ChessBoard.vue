<template>
  <div class="chessboard">
    <template v-for="(row, r) in board" :key="r">
      <ChessSquare 
        v-for="(piece, c) in row" 
        :key="`${r}-${c}`"
        :piece="piece"
        :is-dark="(r + c) % 2 !== 0"
        :is-selected="isSelected(r, c)"
        :is-valid-move="isValidMove(r, c)"
        :is-check="isKingInCheck(piece)"
        @square-click="$emit('square-click', r, c)"
      />
    </template>
  </div>
</template>

<script setup>
import ChessSquare from './ChessSquare.vue';

const props = defineProps({
  board: Array,
  selectedSquare: Object,
  validMoves: Array,
  isCheck: Object
});

defineEmits(['square-click']);

const isSelected = (r, c) => {
  return props.selectedSquare && props.selectedSquare.r === r && props.selectedSquare.c === c;
};

const isValidMove = (r, c) => {
  return props.validMoves.some(m => m.r === r && m.c === c);
};

const isKingInCheck = (piece) => {
  if (!piece || piece[1] !== 'k') return false;
  return props.isCheck[piece[0]];
};
</script>
