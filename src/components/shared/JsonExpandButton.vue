<template>
  <button
    @click="$emit('toggle')"
    class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    title="Show raw transaction data"
  >
    <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
      <text x="8" y="11.5" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">i</text>
    </svg>
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  toggle: []
}>()
</script>
