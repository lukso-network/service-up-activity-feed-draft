import { ref, watch, type Ref, type ComputedRef, isRef } from 'vue'
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
 * 
 * @param profileId - Profile address (string, Ref<string>, or undefined for global feed)
 * @param pageSize - Number of entries per page (default 25)
 */
export function useFeedApi(
  profileId?: string | Ref<string | undefined> | ComputedRef<string | undefined>,
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

  function resetCursor() {
    cursorBlock = undefined
    cursorLogIndex = undefined
  }

  function updateCursor(entries: FeedEntry[]) {
    if (entries.length > 0) {
      const last = entries[entries.length - 1]
      cursorBlock = last.blockNumber
      cursorLogIndex = last.logIndex
    }
  }

  async function fetchPage(): Promise<FeedEntry[]> {
    const id = isRef(profileId) ? profileId.value : profileId
    const entries = id
      ? await fetchFeed(id, pageSize, cursorBlock, cursorLogIndex)
      : await fetchGlobalFeed(pageSize, cursorBlock, cursorLogIndex)

    if (entries.length < pageSize) {
      hasMore.value = false
    }
    updateCursor(entries)
    return entries
  }

  // Load initial page
  async function load() {
    resetCursor()
    hasMore.value = true
    loading.value = true
    error.value = null
    feedEntries.value = []
    
    try {
      const entries = await fetchPage()
      feedEntries.value = entries
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      console.error('[useFeedApi] load failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loadingMore.value || !hasMore.value || loading.value) return
    loadingMore.value = true
    try {
      const entries = await fetchPage()
      if (entries.length > 0) {
        feedEntries.value = [...feedEntries.value, ...entries]
      }
    } catch (e) {
      console.error('[useFeedApi] loadMore failed:', e)
    } finally {
      loadingMore.value = false
    }
  }

  async function refresh() {
    await load()
  }

  // Initial load
  load()

  // Watch for profileId changes if it's a ref
  if (isRef(profileId)) {
    watch(profileId, () => {
      load()
    })
  }

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
