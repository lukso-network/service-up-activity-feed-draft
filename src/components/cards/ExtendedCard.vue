<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 overflow-hidden max-w-full">
    <!-- Header: content wraps, chevron stays top-right -->
    <div class="flex gap-2 mb-3">
      <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <slot name="header" />
      </div>
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
    <!-- Content area -->
    <div>
      <slot name="content" />
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
