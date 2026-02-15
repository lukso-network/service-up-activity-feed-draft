<template>
  <div class="space-y-3 p-4">
    <TransitionGroup name="tx-list">
      <div
        v-for="tx in transactions"
        :key="tx.transactionHash"
      >
        <component
          :is="getCardComponent(tx)"
          :tx="tx"
          :chain-id="chainId"
        />
      </div>
    </TransitionGroup>

    <!-- Load more -->
    <div v-if="hasMore" class="pt-2">
      <button
        @click="$emit('loadMore')"
        :disabled="loadingMore"
        class="w-full py-3 rounded-2xl text-sm font-medium transition-all duration-200
          bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300
          hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="loadingMore" class="inline-flex items-center gap-2">
          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
        <span v-else>Load more</span>
      </button>
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
import type { Component } from 'vue'
import type { Transaction } from '../lib/types'
import { classifyTransaction } from '../lib/formatters'
import TransferCard from './cards/TransferCard.vue'
import FollowCard from './cards/FollowCard.vue'
import RawTransactionCard from './cards/RawTransactionCard.vue'
import ProfileUpdateCard from './cards/ProfileUpdateCard.vue'
import PermissionCard from './cards/PermissionCard.vue'
import GenericCard from './cards/GenericCard.vue'

defineProps<{
  transactions: Transaction[]
  chainId: number
  profileAddress: string
  hasMore: boolean
  loadingMore: boolean
  loading: boolean
}>()

defineEmits<{ loadMore: [] }>()

function getCardComponent(tx: Transaction): Component {
  const { type } = classifyTransaction(tx)
  switch (type) {
    case 'value_transfer':
    case 'token_transfer':
    case 'nft_transfer':
      return TransferCard
    case 'follow':
    case 'unfollow':
      return FollowCard
    case 'profile_update':
      return ProfileUpdateCard
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
