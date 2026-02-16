<template>
  <div class="space-y-3 p-4">
    <TransitionGroup name="tx-list">
      <div
        v-for="tx in flattenedTransactions"
        :key="(tx as any)._virtualKey || tx.transactionHash"
      >
        <component
          :is="getCardComponent(tx)"
          :tx="tx"
          :chain-id="chainId"
        />
      </div>
    </TransitionGroup>

    <!-- Infinite scroll sentinel -->
    <div v-if="hasMore" ref="sentinel" class="flex justify-center py-4">
      <svg v-if="loadingMore" class="animate-spin w-5 h-5 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Empty state -->
    <div v-if="!transactions.length && !loading" class="py-16 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center">
        <svg class="w-8 h-8 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p class="text-neutral-500 dark:text-neutral-400 text-sm">No activity found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import type { Component } from 'vue'
import type { Transaction } from '../lib/types'
import { useAddressResolver } from '../composables/useAddressResolver'
import { classifyTransaction } from '../lib/formatters'
import TransferCard from './cards/TransferCard.vue'
import FollowCard from './cards/FollowCard.vue'
import RawTransactionCard from './cards/RawTransactionCard.vue'
import ProfileUpdateCard from './cards/ProfileUpdateCard.vue'
import PermissionCard from './cards/PermissionCard.vue'
import GenericCard from './cards/GenericCard.vue'
import MomentCard from './cards/MomentCard.vue'
import TokenUpdateCard from './cards/TokenUpdateCard.vue'

const props = defineProps<{
  transactions: Transaction[]
  chainId: number
  profileAddress: string
  hasMore: boolean
  loadingMore: boolean
  loading: boolean
}>()

const emit = defineEmits<{ loadMore: [] }>()

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasMore && !props.loadingMore) {
        emit('loadMore')
      }
    },
    { rootMargin: '200px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

watch(sentinel, (el) => {
  if (observer && el) observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
})

const { getIdentity } = useAddressResolver()

/**
 * Flatten batch transfers to FM NFTs into individual virtual transactions.
 * A transferBatch where recipients are Forever Moments NFTs (Assets, not Profiles)
 * gets split into separate "liked with" cards.
 *
 * Detection: recipients resolve as __gqltype="Asset" (not "Profile").
 * This is reactive — re-evaluates when address identities resolve.
 */
// LIKES_CONTRACT kept in events.ts for reference; batch splitting uses recipient identity check

const flattenedTransactions = computed(() => {
  const result: (Transaction & { _virtualKey?: string })[] = []
  for (const tx of props.transactions) {
    const toArg = tx.args?.find(a => a.name === 'to')
    const amountArg = tx.args?.find(a => a.name === 'amount')
    const fromArg = tx.args?.find(a => a.name === 'from')
    
    if (tx.functionName === 'transferBatch' && 
        Array.isArray(toArg?.value) && Array.isArray(amountArg?.value)) {
      const toArr = toArg!.value as string[]
      const amountArr = amountArg!.value as unknown[]
      const fromArr = Array.isArray(fromArg?.value) ? fromArg!.value as string[] : []
      
      // Check if recipients are Assets (FM NFTs)
      // Note: tx.to may be the token contract OR the KeyManager depending on call chain,
      // so we check recipients directly rather than requiring tx.to === LIKES_CONTRACT
      const recipientsAreAssets = toArr.some(addr => {
        const identity = getIdentity(String(addr))
        return identity && (identity as any).__gqltype === 'Asset'
      })
      
      if (recipientsAreAssets) {
        // Split into individual virtual transactions → each renders as "liked with"
        const dataArg = tx.args?.find(a => a.name === 'data')
        const dataArr = Array.isArray(dataArg?.value) ? dataArg!.value as string[] : []
        for (let i = 0; i < toArr.length; i++) {
          const virtualTx: Transaction & { _virtualKey?: string } = {
            ...tx,
            _virtualKey: `${tx.transactionHash}-${i}`,
            args: [
              { name: 'from', internalType: 'address', type: 'address', value: fromArr[i] || fromArr[0] || tx.from },
              { name: 'to', internalType: 'address', type: 'address', value: String(toArr[i]) },
              { name: 'amount', internalType: 'uint256', type: 'uint256', value: amountArr[i] },
              { name: 'force', internalType: 'bool', type: 'bool', value: false },
              { name: 'data', internalType: 'bytes', type: 'bytes', value: dataArr[i] || '0x' },
            ],
            functionName: 'transfer',
          }
          result.push(virtualTx)
        }
        continue
      }
    }
    result.push(tx)
  }
  return result
})

function getCardComponent(tx: Transaction): Component {
  const { type } = classifyTransaction(tx)
  switch (type) {
    case 'value_transfer':
    case 'token_transfer':
    case 'nft_transfer':
    case 'token_mint':
    case 'nft_mint':
      return TransferCard
    case 'follow':
    case 'unfollow':
      return FollowCard
    case 'create_moment':
      return MomentCard
    case 'profile_update':
      return ProfileUpdateCard
    case 'token_metadata_update':
      return TokenUpdateCard
    case 'permission_change':
      return PermissionCard
    case 'contract_execution':
      return GenericCard
    case 'unknown':
      return RawTransactionCard
    default:
      return RawTransactionCard
  }
}
</script>

<style scoped>
.tx-list-enter-active {
  transition: all 0.4s ease-out;
}
.tx-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.tx-list-move {
  transition: transform 0.3s ease;
}
</style>
