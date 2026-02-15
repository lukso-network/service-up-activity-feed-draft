import { ref, type Ref } from 'vue'
import { fetchActivity } from '../lib/api'
import type { Transaction } from '../lib/types'

export function useActivity(chainId: Ref<number>, address: Ref<string>) {
  const transactions = ref<Transaction[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(false)
  const nextToBlock = ref<number | null>(null)
  const latestBlockNumber = ref<number>(0)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetchActivity(chainId.value, address.value)
      transactions.value = res.data.sort((a, b) => {
        // Sort by blockTimestamp (actual tx time), newest first
        const tsA = a.blockTimestamp || 0
        const tsB = b.blockTimestamp || 0
        if (tsB !== tsA) return tsB - tsA
        // Same timestamp: sort by transactionIndex descending
        const idxA = a.transactionIndex || 0
        const idxB = b.transactionIndex || 0
        return idxB - idxA
      })
      hasMore.value = res.pagination.hasMore
      nextToBlock.value = res.pagination.nextToBlock
      if (res.data.length > 0) {
        latestBlockNumber.value = parseInt(res.data[0].blockNumber)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load activity'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!nextToBlock.value || loadingMore.value) return
    loadingMore.value = true
    try {
      const res = await fetchActivity(chainId.value, address.value, {
        toBlock: nextToBlock.value,
      })
      const sorted = res.data.sort((a, b) => {
        const tsA = a.blockTimestamp || 0
        const tsB = b.blockTimestamp || 0
        if (tsB !== tsA) return tsB - tsA
        return (b.transactionIndex || 0) - (a.transactionIndex || 0)
      })
      transactions.value = [...transactions.value, ...sorted]
      hasMore.value = res.pagination.hasMore
      nextToBlock.value = res.pagination.nextToBlock
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load more'
    } finally {
      loadingMore.value = false
    }
  }

  async function pollNew() {
    if (!latestBlockNumber.value) return
    try {
      const res = await fetchActivity(chainId.value, address.value, {
        fromBlock: latestBlockNumber.value + 1,
      })
      if (res.data.length > 0) {
        transactions.value = [...res.data, ...transactions.value]
        latestBlockNumber.value = parseInt(res.data[0].blockNumber)
      }
    } catch {
      // Silently fail polling
    }
  }

  return {
    transactions,
    loading,
    loadingMore,
    error,
    hasMore,
    load,
    loadMore,
    pollNew,
  }
}
