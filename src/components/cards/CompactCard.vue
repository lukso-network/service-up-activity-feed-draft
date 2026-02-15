<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 overflow-hidden max-w-full">
    <div class="flex items-center gap-3 min-w-0 overflow-hidden">
      <slot />
      <!-- Explorer link -->
      <a
        v-if="tx?.transactionHash"
        :href="`https://explorer.lukso.network/tx/${tx.transactionHash}`"
        target="_blank"
        rel="noopener noreferrer"
        class="flex-shrink-0 text-neutral-300 hover:text-blue-500 dark:text-neutral-600 dark:hover:text-blue-400 transition-colors"
        title="View on Explorer"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>
    </div>
    <TxDetails v-if="tx" :tx="tx" />
  </div>
</template>

<script setup lang="ts">
import TxDetails from '../shared/TxDetails.vue'

defineProps<{
  tx?: Record<string, unknown>
}>()
</script>
