<template>
  <div class="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2 text-sm">
    <!-- Transaction Hash -->
    <div class="flex flex-col gap-1">
      <span class="text-xs text-neutral-400">Transaction Hash</span>
      <a
        :href="`https://explorer.lukso.network/tx/${tx.transactionHash}`"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 break-all"
      >
        {{ tx.transactionHash }}
      </a>
    </div>

    <!-- From -->
    <div class="flex flex-col gap-1">
      <span class="text-xs text-neutral-400">From</span>
      <a
        :href="`https://explorer.lukso.network/address/${tx.from}`"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 break-all"
      >
        {{ tx.from }}
      </a>
    </div>

    <!-- To -->
    <div class="flex flex-col gap-1">
      <span class="text-xs text-neutral-400">To</span>
      <a
        :href="`https://explorer.lukso.network/address/${tx.to}`"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 break-all"
      >
        {{ tx.to }}
      </a>
    </div>

    <!-- Selector (if present) -->
    <div v-if="tx.sig" class="flex flex-col gap-1">
      <span class="text-xs text-neutral-400">Function Selector</span>
      <span class="font-mono text-xs text-neutral-600 dark:text-neutral-300">{{ tx.sig }}</span>
    </div>

    <!-- Gas Used -->
    <div v-if="tx.gasUsed" class="flex flex-col gap-1">
      <span class="text-xs text-neutral-400">Gas Used</span>
      <span class="text-xs text-neutral-600 dark:text-neutral-300">{{ formatNumber(tx.gasUsed) }}</span>
    </div>

    <!-- Status -->
    <div v-if="tx.status !== undefined" class="flex flex-col gap-1">
      <span class="text-xs text-neutral-400">Status</span>
      <span class="text-xs" :class="tx.status === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
        {{ tx.status === 1 ? '✓ Success' : '✗ Failed' }}
      </span>
    </div>

    <!-- Raw JSON toggle -->
    <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
      <button
        @click="showRaw = !showRaw"
        class="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <svg
          class="w-3 h-3 transition-transform"
          :class="{ 'rotate-90': showRaw }"
          viewBox="0 0 8 10"
          fill="currentColor"
        >
          <path d="M1 1l5 4-5 4V1z" />
        </svg>
        <span>{{ showRaw ? 'Hide' : 'Show' }} Raw JSON</span>
      </button>
      <pre
        v-if="showRaw"
        class="mt-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-72 overflow-y-auto font-mono leading-relaxed"
      >{{ JSON.stringify(tx, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  tx: Record<string, unknown>
}>()

const showRaw = ref(false)

function formatNumber(val: unknown): string {
  const str = String(val).replace('n', '')
  const num = parseInt(str)
  if (isNaN(num)) return str
  return num.toLocaleString()
}
</script>
