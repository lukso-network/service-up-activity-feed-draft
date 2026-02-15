<template>
  <a
    :href="explorerUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:border-lukso-pink/30 dark:hover:border-lukso-pink/30 hover:shadow-md transition-all duration-200 group"
  >
    <!-- Top row: type badge + timestamp -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-base leading-none">{{ classification.icon }}</span>
        <span
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="badgeClasses"
        >
          {{ classification.label }}
        </span>
        <span
          v-if="tx.status === 0"
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        >
          Failed
        </span>
      </div>
      <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
        {{ relativeTime }}
      </span>
    </div>

    <!-- From → To -->
    <div class="flex items-center gap-2 text-sm mb-2">
      <AddressDisplay :address="tx.from" :chain-id="chainId" :is-self="isSelfFrom" />
      <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
      <AddressDisplay :address="tx.to" :chain-id="chainId" :is-self="isSelfTo" />
    </div>

    <!-- Details: decoded args, value -->
    <div class="flex items-center gap-2 flex-wrap">
      <span v-if="valueDisplay" class="text-xs font-medium px-2 py-1 rounded-md bg-lukso-pink/10 text-lukso-pink dark:bg-lukso-pink/20">
        {{ valueDisplay }}
      </span>
      <span v-if="detailText" class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
        {{ detailText }}
      </span>
      <span class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </span>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction } from '../lib/types'
import { formatRelativeTime, formatLYX, classifyTransaction, getExplorerUrl } from '../lib/formatters'
import AddressDisplay from './AddressDisplay.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
  profileAddress: string
}>()

const classification = computed(() => classifyTransaction(props.tx))

const relativeTime = computed(() => formatRelativeTime(props.tx.blockTimestamp))

const explorerUrl = computed(() => getExplorerUrl(props.tx.transactionHash, props.chainId))

const valueDisplay = computed(() => formatLYX(props.tx.value || '0'))

const isSelfFrom = computed(() =>
  props.tx.from.toLowerCase() === props.profileAddress.toLowerCase()
)

const isSelfTo = computed(() =>
  props.tx.to.toLowerCase() === props.profileAddress.toLowerCase()
)

const detailText = computed(() => {
  const args = props.tx.args
  if (!args?.length) return null

  // For token transfers, show amount and token details
  if (props.tx.standard === 'LSP7DigitalAsset') {
    const amount = args.find(a => a.name === 'amount')
    if (amount) {
      const formatted = formatLYX(String(amount.value))
      if (formatted) return formatted
    }
  }

  // For LSP8 (NFTs), show token ID
  if (props.tx.standard === 'LSP8IdentifiableDigitalAsset') {
    const tokenId = args.find(a => a.name === 'tokenId')
    if (tokenId) return `Token #${String(tokenId.value).slice(0, 10)}`
  }

  return null
})

const badgeClasses = computed(() => {
  const base = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
  switch (classification.value.type) {
    case 'value_transfer':
      return 'bg-pink-50 text-lukso-pink dark:bg-pink-900/20 dark:text-pink-400'
    case 'token_transfer':
      return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'nft_transfer':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
    case 'follow':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    case 'unfollow':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
    case 'profile_update':
      return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    case 'permission_change':
      return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    default:
      return base
  }
})
</script>
