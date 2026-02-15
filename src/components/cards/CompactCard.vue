<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 overflow-hidden max-w-full">
    <div class="flex gap-3">
      <!-- Main content area — wraps freely -->
      <div class="flex items-center gap-3 min-w-0 flex-wrap flex-1">
        <slot />
      </div>
      <!-- Chevron — always top-right -->
      <button
        v-if="tx"
        @click="expanded = !expanded"
        class="flex-shrink-0 self-start mt-1 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all"
      >
        <svg
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': expanded }"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
    <TxDetails v-if="expanded && tx" :tx="tx" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TxDetails from '../shared/TxDetails.vue'

defineProps<{
  tx?: Record<string, unknown>
}>()

const expanded = ref(false)
</script>
