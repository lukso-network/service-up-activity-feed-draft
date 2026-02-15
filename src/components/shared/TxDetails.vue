<template>
  <div>
    <!-- Expandable details -->
    <button
      @click="expanded = !expanded"
      class="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-500 dark:hover:text-neutral-300 transition-colors mt-2"
    >
      <svg
        class="w-3 h-3 transition-transform"
        :class="{ 'rotate-90': expanded }"
        viewBox="0 0 8 10"
        fill="currentColor"
      >
        <path d="M1 1l5 4-5 4V1z" />
      </svg>
      <span>{{ expanded ? 'Hide details' : 'More details' }}</span>
    </button>

    <div v-if="expanded" class="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs space-y-1.5">
      <!-- Structured info -->
      <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span class="text-neutral-400">Tx Hash</span>
        <span class="font-mono text-neutral-600 dark:text-neutral-300 break-all">{{ tx.transactionHash }}</span>

        <span class="text-neutral-400">From</span>
        <span class="font-mono text-neutral-600 dark:text-neutral-300 break-all">{{ tx.from }}</span>

        <span class="text-neutral-400">To</span>
        <span class="font-mono text-neutral-600 dark:text-neutral-300 break-all">{{ tx.to }}</span>

        <template v-if="tx.sig">
          <span class="text-neutral-400">Selector</span>
          <span class="font-mono text-neutral-600 dark:text-neutral-300">{{ tx.sig }}</span>
        </template>

        <template v-if="tx.gasUsed">
          <span class="text-neutral-400">Gas Used</span>
          <span class="text-neutral-600 dark:text-neutral-300">{{ formatNumber(tx.gasUsed) }}</span>
        </template>

        <template v-if="tx.status !== undefined">
          <span class="text-neutral-400">Status</span>
          <span :class="tx.status === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-500'">
            {{ tx.status === 1 ? 'Success' : 'Failed' }}
          </span>
        </template>
      </div>

      <!-- Explorer link -->
      <a
        :href="`https://explorer.lukso.network/tx/${tx.transactionHash}`"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-2"
      >
        View on Explorer ↗
      </a>

      <!-- Raw JSON toggle -->
      <div class="pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <button
          @click="showRaw = !showRaw"
          class="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
        >
          <svg
            class="w-3 h-3 transition-transform"
            :class="{ 'rotate-90': showRaw }"
            viewBox="0 0 8 10"
            fill="currentColor"
          >
            <path d="M1 1l5 4-5 4V1z" />
          </svg>
          <span>{{ showRaw ? 'Hide' : 'Raw' }} JSON</span>
        </button>
        <pre
          v-if="showRaw"
          class="mt-2 p-3 bg-white dark:bg-neutral-900 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-72 overflow-y-auto font-mono leading-relaxed"
        >{{ JSON.stringify(tx, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  tx: Record<string, unknown>
}>()

const expanded = ref(false)
const showRaw = ref(false)

function formatNumber(val: unknown): string {
  const str = String(val).replace('n', '')
  const num = parseInt(str)
  if (isNaN(num)) return str
  return num.toLocaleString()
}
</script>
