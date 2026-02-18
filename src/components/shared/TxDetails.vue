<template>
  <div class="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs space-y-2 font-mono">
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Tx Hash</span>
      <a
        :href="`https://explorer.lukso.network/tx/${tx.transactionHash}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 truncate"
      >
        {{ tx.transactionHash }}
      </a>
    </div>
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">From</span>
      <a
        :href="`https://explorer.lukso.network/address/${tx.from}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 truncate"
      >
        {{ tx.from }}
      </a>
    </div>
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">To</span>
      <a
        :href="`https://explorer.lukso.network/address/${tx.to}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 truncate"
      >
        {{ tx.to }}
      </a>
    </div>
    <div v-if="tx.sig || (tx.functionName && tx.functionName !== 'execute')" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Selector</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ tx.sig || '' }}{{ tx.functionName ? ` (${tx.functionName})` : '' }}</span>
    </div>
    <div v-if="tx.gasUsed" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Gas Used</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ formatNumber(tx.gasUsed) }}</span>
    </div>
    <div v-if="tx.status !== undefined" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Status</span>
      <span :class="tx.status === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-500'">
        {{ tx.status === 1 ? 'Success' : 'Failed' }}
      </span>
    </div>

    <!-- Raw JSON toggle -->
    <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800 font-sans">
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
      <button
        @click="copyRawJson"
        class="ml-3 text-xs text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        {{ copied ? '✓ Copied' : '📋 Copy JSON' }}
      </button>
      <pre
        v-if="showRaw"
        class="mt-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-72 overflow-y-auto font-mono leading-relaxed"
      >{{ safeStringify(tx) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  tx: Record<string, unknown>
}>()

const showRaw = ref(false)
const copied = ref(false)

function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2)
}

function copyRawJson() {
  const text = safeStringify(props.tx)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    })
  } else {
    // Fallback for non-HTTPS (e.g. Tailscale dev)
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function formatNumber(val: unknown): string {
  const str = String(val).replace('n', '')
  const num = parseInt(str)
  if (isNaN(num)) return str
  return num.toLocaleString()
}
</script>
