<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 overflow-hidden max-w-full">
    <div class="flex gap-2 cursor-pointer" @click="toggleIfBackground">
      <!-- Main content area — wraps freely -->
      <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1 card-flow">
        <slot />
      </div>
      <!-- Chevron — always top-right -->
      <div
        v-if="tx"
        class="flex-shrink-0 self-start mt-1 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all"
      >
        <svg
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': expanded }"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
    <template v-if="expanded && tx">
      <slot name="details" :tx="tx">
        <TxDetails :tx="tx" />
      </slot>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TxDetails from '../shared/TxDetails.vue'

const props = defineProps<{
  tx?: Record<string, unknown>
}>()

const expanded = ref(false)

function toggleIfBackground(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('a, button, lukso-username, lukso-profile, input, select')) return
  if (!props.tx) return
  expanded.value = !expanded.value
}
</script>
