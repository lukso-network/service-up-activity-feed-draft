import { ref, type Ref } from 'vue'
import { fetchFeed, fetchGlobalFeed } from '../lib/feedApi'
import type { FeedEntry } from '../lib/feedTypes'

export interface UseFeedApiReturn {
  feedEntries: Ref<FeedEntry[]>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  error: Ref<Error | null>
  hasMore: Ref<boolean>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Vue composable for the Envio Feed API.
 * Replaces useTransactionList from @lukso/activity-sdk.
 */
export function useFeedApi(
  profileId?: string,
  pageSize: number = 25,
): UseFeedApiReturn {
  const feedEntries = ref<FeedEntry[]>([])
  const loading = ref(true)
  const loadingMore = ref(false)
  const error = ref<Error | null>(null)
  const hasMore = ref(true)

  // Cursor state for pagination
  let cursorBlock: number | undefined
  let cursorLogIndex: number | undefined

  function updateCursor(entries: FeedEntry[]) {
    if (entries.length > 0) {
      const last = entries[entries.length - 1]
      cursorBlock = last.blockNumber
      cursorLogIndex = last.logIndex
    }
  }

  async function fetchPage(): Promise<FeedEntry[]> {
    const entries = profileId
      ? await fetchFeed(profileId, pageSize, cursorBlock, cursorLogIndex)
      : await fetchGlobalFeed(pageSize, cursorBlock, cursorLogIndex)

    if (entries.length < pageSize) {
      hasMore.value = false
    }
    updateCursor(entries)
    return entries
  }

  // Initial load
  async function init() {
    loading.value = true
    error.value = null
    try {
      const entries = await fetchPage()
      feedEntries.value = entries
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    try {
      const entries = await fetchPage()
      feedEntries.value = [...feedEntries.value, ...entries]
    } catch (e) {
      console.error('[useFeedApi] loadMore failed:', e)
    } finally {
      loadingMore.value = false
    }
  }

  async function refresh() {
    cursorBlock = undefined
    cursorLogIndex = undefined
    hasMore.value = true
    loading.value = true
    error.value = null
    try {
      const entries = await fetchPage()
      feedEntries.value = entries
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  // Kick off initial fetch
  init()

  return {
    feedEntries: feedEntries as Ref<FeedEntry[]>,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  }
}
