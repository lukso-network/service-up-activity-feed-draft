import { ref, watch, type Ref, type ComputedRef, isRef } from 'vue'
import { fetchFeed, fetchGlobalFeed, extractEnrichedIdentities } from '../lib/feedApi'
import { fetchStakingverseDepositEntries } from '../lib/stakingverseExplorerFeed'
import { DEFAULT_CHAIN_ID, LUKSO_MAINNET_CHAIN_ID } from '../lib/chains'
import type { FeedEntry } from '../lib/feedTypes'

export interface UseFeedApiReturn {
  feedEntries: Ref<FeedEntry[]>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  error: Ref<Error | null>
  hasMore: Ref<boolean>
  /** Pre-loaded identity data extracted from feed query relationships */
  enrichedIdentities: Ref<Record<string, any>>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Vue composable for the Envio Feed API.
 * Replaces useTransactionList from @lukso/activity-sdk.
 *
 * @param profileId - Profile address (string, Ref<string>, or undefined for global feed)
 * @param pageSize - Number of entries per page (default 25)
 * @param chainId - LUKSO chain id selecting the indexer endpoint (default mainnet)
 */
export function useFeedApi(
  profileId?: string | Ref<string | undefined> | ComputedRef<string | undefined>,
  pageSize: number = 25,
  chainId?: number | Ref<number> | ComputedRef<number>,
): UseFeedApiReturn {
  const feedEntries = ref<FeedEntry[]>([])
  const loading = ref(true)
  const loadingMore = ref(false)
  const error = ref<Error | null>(null)
  const hasMore = ref(true)
  const enrichedIdentities = ref<Record<string, any>>({})

  // Cursor state for pagination — the full (blockNumber, transactionIndex, logIndex)
  // tuple is required to uniquely order rows across same-block transactions.
  let cursorBlock: number | undefined
  let cursorTransactionIndex: number | undefined
  let cursorLogIndex: number | undefined
  let generation = 0
  let newestPageLoading = false

  interface FeedPage {
    entries: FeedEntry[]
    hasMore: boolean
    cursorEntry?: FeedEntry
  }

  function applyPageState(page: FeedPage) {
    hasMore.value = page.hasMore
    if (page.cursorEntry) {
      const last = page.cursorEntry
      cursorBlock = last.blockNumber
      cursorTransactionIndex = last.transactionIndex ?? 0
      cursorLogIndex = last.logIndex
    }
  }

  /** Merge new enriched identities from a batch of entries */
  function mergeEnrichedIdentities(entries: FeedEntry[]) {
    const newIdentities = extractEnrichedIdentities(entries)
    if (Object.keys(newIdentities).length > 0) {
      enrichedIdentities.value = { ...enrichedIdentities.value, ...newIdentities }
    }
  }

  async function fetchPage(
    beforeBlock?: number,
    beforeTransactionIndex?: number,
    beforeLogIndex?: number,
  ): Promise<FeedPage> {
    const id = isRef(profileId) ? profileId.value : profileId
    const chain = (isRef(chainId) ? chainId.value : chainId) ?? DEFAULT_CHAIN_ID
    const feedApiEntries = id
      ? await fetchFeed(id, pageSize, beforeBlock, beforeTransactionIndex, beforeLogIndex, chain)
      : await fetchGlobalFeed(pageSize, beforeBlock, beforeTransactionIndex, beforeLogIndex, chain)
    const lastFeedEntry = feedApiEntries[feedApiEntries.length - 1]
    // The Stakingverse supplement is mainnet-only — both the explorer base URL and
    // the vault address it filters on are mainnet, so running it on another chain
    // would splice mainnet deposits into that chain's feed.
    const stakingverseEntries = chain === LUKSO_MAINNET_CHAIN_ID
      ? await fetchStakingverseDepositEntries(
          id,
          pageSize,
          beforeBlock,
          beforeTransactionIndex,
          beforeLogIndex,
          lastFeedEntry?.blockNumber,
          lastFeedEntry?.transactionIndex ?? 0,
          lastFeedEntry?.logIndex,
        )
      : []
    const entries = mergeAndSortEntries(feedApiEntries, stakingverseEntries)

    const cursorEntries = feedApiEntries.length ? feedApiEntries : entries
    return {
      entries,
      hasMore: feedApiEntries.length >= pageSize || stakingverseEntries.length >= pageSize,
      cursorEntry: cursorEntries[cursorEntries.length - 1],
    }
  }

  // Load the newest page. Refreshes preserve the current list until the replacement
  // page is ready, avoiding a loading flash and scroll-position loss during polling.
  async function load(preserveEntries = false) {
    const requestGeneration = ++generation
    newestPageLoading = true
    loadingMore.value = false
    hasMore.value = true
    loading.value = !preserveEntries
    error.value = null
    if (!preserveEntries) {
      feedEntries.value = []
      enrichedIdentities.value = {}
    }

    try {
      const page = await fetchPage()
      if (requestGeneration !== generation) return

      cursorBlock = undefined
      cursorTransactionIndex = undefined
      cursorLogIndex = undefined
      applyPageState(page)
      feedEntries.value = mergeAndSortEntries([], page.entries)
      enrichedIdentities.value = {}
      mergeEnrichedIdentities(page.entries)
    } catch (e) {
      if (requestGeneration !== generation) return
      error.value = e instanceof Error ? e : new Error(String(e))
      console.error('[useFeedApi] load failed:', e)
    } finally {
      if (requestGeneration === generation) {
        newestPageLoading = false
        loading.value = false
      }
    }
  }

  async function loadMore() {
    if (loadingMore.value || newestPageLoading || !hasMore.value || loading.value) return
    const requestGeneration = generation
    loadingMore.value = true
    try {
      const page = await fetchPage(cursorBlock, cursorTransactionIndex, cursorLogIndex)
      if (requestGeneration !== generation) return

      applyPageState(page)
      if (page.entries.length > 0) {
        feedEntries.value = mergeAndSortEntries(feedEntries.value, page.entries)
        mergeEnrichedIdentities(page.entries)
      }
    } catch (e) {
      if (requestGeneration !== generation) return
      console.error('[useFeedApi] loadMore failed:', e)
      // Stop pagination on failure — the cursor wasn't advanced, so without
      // this the IntersectionObserver would loop the same failing fetch
      // forever and never hide the spinner. User can pull-to-refresh to retry.
      hasMore.value = false
    } finally {
      if (requestGeneration === generation) loadingMore.value = false
    }
  }

  async function refresh() {
    await load(true)
  }

  // Initial load
  load()

  // Reload when the profile or the chain changes — the profile selects a different
  // feed, the chain selects both a different feed and a different indexer endpoint.
  const reactiveSources = [profileId, chainId].filter(isRef)
  if (reactiveSources.length > 0) {
    watch(reactiveSources, () => {
      load()
    })
  }

  return {
    feedEntries: feedEntries as Ref<FeedEntry[]>,
    loading,
    loadingMore,
    error,
    hasMore,
    enrichedIdentities,
    loadMore,
    refresh,
  }
}

function mergeAndSortEntries(primary: FeedEntry[], secondary: FeedEntry[]): FeedEntry[] {
  const seen = new Set<string>()
  const merged: FeedEntry[] = []

  for (const entry of [...primary, ...secondary]) {
    const key = entry.transactionHash || entry.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }

  return merged.sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber
    if ((b.transactionIndex ?? 0) !== (a.transactionIndex ?? 0)) {
      return (b.transactionIndex ?? 0) - (a.transactionIndex ?? 0)
    }
    return b.logIndex - a.logIndex
  })
}
