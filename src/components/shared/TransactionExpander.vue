<template>
  <div class="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs space-y-2 font-mono">
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Tx Hash</span>
      <a
        :href="explorerUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-lukso-pink hover:underline truncate"
      >
        {{ tx.transactionHash }}
      </a>
    </div>
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">From</span>
      <span class="text-neutral-700 dark:text-neutral-300 truncate">{{ tx.from }}</span>
    </div>
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">To</span>
      <span class="text-neutral-700 dark:text-neutral-300 truncate">{{ tx.to }}</span>
    </div>
    <div v-if="hasValue" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Value</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ formattedValue }}</span>
    </div>
    <div v-if="tx.functionName" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Function</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ tx.functionName }}</span>
    </div>
    <div v-if="!tx.functionName && tx.input && tx.input.length > 2" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Selector</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ tx.input.slice(0, 10) }}</span>
    </div>
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Gas Used</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ parseInt(tx.gasUsed).toLocaleString() }}</span>
    </div>
    <div class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Status</span>
      <span :class="tx.status === 1 ? 'text-green-600' : 'text-red-500'">
        {{ tx.status === 1 ? 'Success' : 'Failed' }}
      </span>
    </div>
    <div v-if="tx.logs?.length" class="flex gap-2">
      <span class="text-neutral-400 w-20 flex-shrink-0">Logs</span>
      <span class="text-neutral-700 dark:text-neutral-300">{{ tx.logs.length }} event{{ tx.logs.length > 1 ? 's' : '' }} emitted</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction } from '../../lib/types'
import { formatLYX, getExplorerUrl } from '../../lib/formatters'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const explorerUrl = computed(() => getExplorerUrl(props.tx.transactionHash, props.chainId))
const hasValue = computed(() => BigInt(props.tx.value || '0') > 0n)
const formattedValue = computed(() => formatLYX(props.tx.value || '0'))
</script>
