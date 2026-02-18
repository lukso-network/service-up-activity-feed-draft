import { ref, computed, type Ref } from 'vue'
import { fetchActivity } from '../lib/api'
import type { Transaction } from '../lib/types'

const MIN_VISIBLE_INITIAL = 25
const MIN_VISIBLE_MORE = 10
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
  const newTxCount = ref(0)
  const nextToBlock = ref<number | null>(null)
  const latestBlockNumber = ref<number>(0)

  // Queued new transactions (from polling) — shown on user action
  const queuedTxs = ref<Transaction[]>([])

  const isFiltering = computed(() => !!filterFn?.value)

  function countVisible(): number {
    if (!filterFn?.value) return transactions.value.length
    return transactions.value.filter(filterFn.value).length
  }

  /**
   * Keeps fetching pages until at least `targetVisible` items pass the
   * current filter. Skipped entirely when no filter is active (dev mode).
   */
  async function ensureVisible(targetVisible: number) {
    if (!isFiltering.value) return
    let fetches = 0
    while (countVisible() < targetVisible && hasMore.value && nextToBlock.value && fetches < MAX_AUTO_FETCHES) {
      fetches++
      const res = await fetchActivity(chainId.value, address.value, {
        toBlock: nextToBlock.value,
      })
      const data = res.data || []
      transactions.value = dedup([...transactions.value, ...sortTxs(data)])
      hasMore.value = res.pagination?.hasMore ?? false
      nextToBlock.value = res.pagination?.nextToBlock ?? null
      if (!data.length) break
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetchActivity(chainId.value, address.value)
      const data = res.data || []
      transactions.value = dedup(sortTxs(data))
      hasMore.value = res.pagination?.hasMore ?? false
      nextToBlock.value = res.pagination?.nextToBlock ?? null
      if (data.length > 0) {
        latestBlockNumber.value = parseInt(data[0].blockNumber)
      }
      await ensureVisible(MIN_VISIBLE_INITIAL)
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
      const data = res.data || []
      transactions.value = dedup([...transactions.value, ...sortTxs(data)])
      hasMore.value = res.pagination?.hasMore ?? false
      nextToBlock.value = res.pagination?.nextToBlock ?? null
      await ensureVisible(visibleBefore + MIN_VISIBLE_MORE)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load more'
    } finally {
      loadingMore.value = false
    }
  }

  /** Poll for new transactions — queues them for user to reveal */
  async function pollNew() {
    if (!latestBlockNumber.value) return
    try {
      const res = await fetchActivity(chainId.value, address.value, {
        fromBlock: latestBlockNumber.value + 1,
      })
      const data = res.data || []
      if (data.length > 0) {
        const newSorted = sortTxs(data)
        // Deduplicate against existing
        const existingHashes = new Set(transactions.value.map(t => t.transactionHash))
        const unique = newSorted.filter(t => !existingHashes.has(t.transactionHash))
        if (unique.length > 0) {
          queuedTxs.value = dedup([...unique, ...queuedTxs.value])
          // Count only filtered-visible new txs
          const filter = filterFn?.value
          newTxCount.value = filter
            ? queuedTxs.value.filter(filter).length
            : queuedTxs.value.length
          latestBlockNumber.value = parseInt(newSorted[0].blockNumber)
        }
      }
    } catch {
      // Silently fail polling
    }
  }

  /** Merge queued new transactions into the feed */
  function showNew() {
    if (queuedTxs.value.length === 0) return
    transactions.value = dedup([...sortTxs(queuedTxs.value), ...transactions.value])
    queuedTxs.value = []
    newTxCount.value = 0
  }

  /** Pull-to-refresh: fetch latest and merge, without full reload */
  async function pollNow() {
    showNew() // merge any already-queued
    await pollNew() // fetch latest
    showNew() // merge what we just fetched
  }

  return {
    transactions,
    loading,
    loadingMore,
    error,
    hasMore,
    newTxCount,
    load,
    loadMore,
    showNew,
    pollNow,
  }
}
