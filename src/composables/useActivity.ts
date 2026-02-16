import { ref, type Ref } from 'vue'
import { fetchActivity } from '../lib/api'
import type { Transaction } from '../lib/types'

const MIN_VISIBLE = 25
const MAX_AUTO_FETCHES = 20 // safety limit

function sortTxs(data: Transaction[]): Transaction[] {
  return [...data].sort((a, b) => {
    const tsA = a.blockTimestamp || 0
    const tsB = b.blockTimestamp || 0
    if (tsB !== tsA) return tsB - tsA
    return (b.transactionIndex || 0) - (a.transactionIndex || 0)
  })
}

function dedup(txs: Transaction[]): Transaction[] {
  const seen = new Set<string>()
  return txs.filter(tx => {
    if (seen.has(tx.transactionHash)) return false
    seen.add(tx.transactionHash)
    return true
  })
}

export function useActivity(
  chainId: Ref<number>,
  address: Ref<string>,
  filterFn?: Ref<((tx: Transaction) => boolean) | null>
) {
  const transactions = ref<Transaction[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(false)
  const nextToBlock = ref<number | null>(null)
  const latestBlockNumber = ref<number>(0)

  function countVisible(): number {
    if (!filterFn?.value) return transactions.value.length
    return transactions.value.filter(filterFn.value).length
  }

  async function fetchMoreUntilVisible(targetVisible: number) {
    let fetches = 0
    while (countVisible() < targetVisible && hasMore.value && nextToBlock.value && fetches < MAX_AUTO_FETCHES) {
      fetches++
      const res = await fetchActivity(chainId.value, address.value, {
        toBlock: nextToBlock.value,
      })
      transactions.value = dedup([...transactions.value, ...sortTxs(res.data)])
      hasMore.value = res.pagination.hasMore
      nextToBlock.value = res.pagination.nextToBlock
      if (!res.data.length) break
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetchActivity(chainId.value, address.value)
      transactions.value = dedup(sortTxs(res.data))
      hasMore.value = res.pagination.hasMore
      nextToBlock.value = res.pagination.nextToBlock
      if (res.data.length > 0) {
        latestBlockNumber.value = parseInt(res.data[0].blockNumber)
      }
      // Auto-fetch more if too few visible transactions
      await fetchMoreUntilVisible(MIN_VISIBLE)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load activity'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!nextToBlock.value || loadingMore.value) return
    loadingMore.value = true
    const visibleBefore = countVisible()
    try {
      const res = await fetchActivity(chainId.value, address.value, {
        toBlock: nextToBlock.value,
      })
      transactions.value = dedup([...transactions.value, ...sortTxs(res.data)])
      hasMore.value = res.pagination.hasMore
      nextToBlock.value = res.pagination.nextToBlock
      // Keep fetching until we have another batch of visible items
      await fetchMoreUntilVisible(visibleBefore + MIN_VISIBLE)
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
        transactions.value = dedup([...res.data, ...transactions.value])
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
