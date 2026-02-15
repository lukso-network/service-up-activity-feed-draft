<template>
  <div class="divide-y divide-gray-50 dark:divide-gray-800/50">
    <TransitionGroup name="tx-list">
      <div
        v-for="tx in transactions"
        :key="tx.transactionHash"
        class="px-4 py-2"
      >
        <TransactionCard
          :tx="tx"
          :chain-id="chainId"
          :profile-address="profileAddress"
        />
      </div>
    </TransitionGroup>

    <!-- Load more -->
    <div v-if="hasMore" class="p-4">
      <button
        @click="$emit('loadMore')"
        :disabled="loadingMore"
        class="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200
          bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300
          hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white
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
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
        <svg class="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p class="text-gray-500 dark:text-gray-400 text-sm">No activity found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Transaction } from '../lib/types'
import TransactionCard from './TransactionCard.vue'

defineProps<{
  transactions: Transaction[]
  chainId: number
  profileAddress: string
  hasMore: boolean
  loadingMore: boolean
  loading: boolean
}>()

defineEmits<{ loadMore: [] }>()
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
