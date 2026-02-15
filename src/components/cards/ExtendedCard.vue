<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 overflow-hidden max-w-full">
    <!-- Header: actor profile + timestamp + chevron -->
    <div class="flex items-center justify-between mb-3">
      <slot name="header" />
      <button
        v-if="tx"
        @click="expanded = !expanded"
        class="flex-shrink-0 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all ml-2"
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
