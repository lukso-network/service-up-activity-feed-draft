import { ref, shallowRef, watch, getCurrentScope, onScopeDispose, type Ref, type ComputedRef, isRef } from 'vue'
import {
  fetchFeed,
  fetchGlobalFeed,
  fetchGlobalFeedAfter,
  extractEnrichedIdentities,
  type FeedRequestOptions,
} from '../lib/feedApi'
import { fetchStakingverseDepositEntries } from '../lib/stakingverseExplorerFeed'
import { DEFAULT_CHAIN_ID, LUKSO_MAINNET_CHAIN_ID } from '../lib/chains'
import { FEED_PAGE_SIZE } from '../lib/feedQuery'
import { readFeedCache, writeFeedCache } from '../lib/feedCache'
import {
  compareFeedPosition,
  feedEntryKey,
  isSupplementEntry,
  mergeAndSortEntries,
  newestIndexedEntry,
  oldestIndexedEntry,
  spliceNewestPage,
} from '../lib/feedMerge'
import type { FeedEntry } from '../lib/feedTypes'

/** New entries found by polling that are not shown yet. */
export interface PendingFeedUpdate {
  /** Newest-first entries waiting to be shown. */
  entries: FeedEntry[]
  /**
   * False: the entries go on top of the list. True: more new rows exist than
   * one page holds, so the entries replace the list (and reset paging).
   */
  replace: boolean
  /** With `replace`: whether older pages exist below the entries. */
  hasMore: boolean
}

export interface ApplyPendingOptions {
  /**
   * Drop the oldest entries beyond a few pages (they can be paged back in).
   * For updates applied while the viewer is at the top, so a feed left open
   * for hours doesn't grow without bound.
   */
  trim?: boolean
}

export interface UseFeedApiReturn {
  feedEntries: Ref<FeedEntry[]>
  /** True only while there is nothing to show yet (no cache, first page in flight). */
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  error: Ref<Error | null>
  hasMore: Ref<boolean>
  /** Pre-loaded identity data extracted from feed query relationships */
  enrichedIdentities: Ref<Record<string, any>>
  /** Entries found by `poll`/revalidation, waiting for `applyPending`. */
  pending: Ref<PendingFeedUpdate | null>
  loadMore: () => Promise<void>
  /**
   * Check for new entries and stage them in `pending`. Cheap enough for a timer:
   * the global feed only asks for rows after the newest known one.
   */
  poll: (newestPage?: boolean) => Promise<void>
  /**
   * Manual refresh: poll, re-check the explorer supplement and recover paging.
   * New rows are staged in `pending`; showing them is up to the caller.
   */
  refresh: () => Promise<void>
  /** Show the staged `pending` entries. */
  applyPending: (options?: ApplyPendingOptions) => void
  /** Start over from the network, e.g. after an error. */
  reload: () => void
}

const CACHE_WRITE_DELAY_MS = 1_500
/** Polls look past the indexer's response cache at this granularity. */
const POLL_CACHE_WINDOW_MS = 15_000
/** `trim`: shorten the list to LIVE_KEEP_ENTRIES once it exceeds LIVE_MAX_ENTRIES. */
const LIVE_MAX_ENTRIES = 150
const LIVE_KEEP_ENTRIES = 100
/** A failed explorer request for a loaded page is retried once after this delay. */
const SUPPLEMENT_RETRY_MS = 10_000

/**
 * Vue composable for the Envio Feed API.
 *
 * Loading strategy:
 * - A cached copy of the feed (localStorage) renders immediately; the newest
 *   page is then fetched in the background and staged in `pending`.
 * - Without a cache, the first page renders as soon as the indexer answers
 *   (often already in flight from index.html); the slower Stakingverse
 *   explorer supplement is merged in afterwards.
 * - `poll`/`refresh` never truncate what the viewer has scrolled through: new
 *   entries go on top, and only a gap larger than a page replaces the list.
 *
 * Stakingverse supplement: direct deposits are not indexed by Envio and come
 * from the explorer. Each loaded page is checked once (retried once on
 * failure). Checks for new activity — refresh, profile polls, a revalidated
 * cache — cover everything added since the last successful check and always
 * re-check at least the newest page (the whole cached range after a cached
 * start), as the full reload did before, so a deposit the explorer had not
 * listed yet is found by the next check.
 *
 * @param profileId - Profile address (string, Ref<string>, or undefined for global feed)
 * @param pageSize - Number of entries per page (default FEED_PAGE_SIZE)
 * @param chainId - LUKSO chain id selecting the indexer endpoint (default mainnet)
 */
export function useFeedApi(
  profileId?: string | Ref<string | undefined> | ComputedRef<string | undefined>,
  pageSize: number = FEED_PAGE_SIZE,
  chainId?: number | Ref<number> | ComputedRef<number>,
): UseFeedApiReturn {
  const feedEntries = shallowRef<FeedEntry[]>([])
  const loading = ref(true)
  const loadingMore = ref(false)
  const error = ref<Error | null>(null)
  const hasMore = ref(true)
  const enrichedIdentities = shallowRef<Record<string, any>>({})
  const pending = shallowRef<PendingFeedUpdate | null>(null)

  // Paging cursor: the oldest indexer row loaded so far — or, when a page held
  // only explorer rows, the oldest of those. The full (blockNumber,
  // transactionIndex, logIndex) tuple is required to order same-block rows.
  let cursor: FeedEntry | undefined
  // Bumped whenever the list is reset (route change, reload, replacing apply,
  // unmount), so responses for the previous list are dropped.
  let generation = 0
  // Bumped per loaded page; only the latest page's supplement may change the
  // paging state (cursor, hasMore).
  let pageSeq = 0
  // A failed older-page request hides the sentinel to avoid a retry loop; the
  // next successful poll or refresh brings paging back.
  let pagingFailed = false
  let inflightPoll: Promise<void> | null = null
  // Newest indexer row at the time of the last successful open-ended explorer
  // check: the next check must reach at least this far down.
  let checkedUpTo: FeedEntry | undefined
  let cacheWriteTimer: ReturnType<typeof setTimeout> | null = null
  // The feed this generation shows, fixed at start(): route params can change
  // before the watcher restarts the feed.
  let feedChain = DEFAULT_CHAIN_ID
  let feedProfile: string | undefined
  let disposed = false

  const readProfile = () => (isRef(profileId) ? profileId.value : profileId) || undefined
  const readChain = () => (isRef(chainId) ? chainId.value : chainId) ?? DEFAULT_CHAIN_ID

  function setEntries(entries: FeedEntry[]) {
    feedEntries.value = entries
    scheduleCacheWrite()
  }

  function mergeEnrichedIdentities(entries: FeedEntry[]) {
    const newIdentities = extractEnrichedIdentities(entries)
    if (Object.keys(newIdentities).length > 0) {
      enrichedIdentities.value = { ...enrichedIdentities.value, ...newIdentities }
    }
  }

  function scheduleCacheWrite() {
    if (disposed) return
    if (cacheWriteTimer) clearTimeout(cacheWriteTimer)
    const writeGeneration = generation
    const chain = feedChain
    const id = feedProfile
    cacheWriteTimer = setTimeout(() => {
      cacheWriteTimer = null
      if (disposed || writeGeneration !== generation) return
      // A failed page is not the end of the feed; don't persist it as one.
      writeFeedCache(chain, id, feedEntries.value, hasMore.value || pagingFailed)
    }, CACHE_WRITE_DELAY_MS)
  }

  /** One page of indexer rows, newest first. */
  async function fetchIndexedPage(before?: FeedEntry, options?: FeedRequestOptions): Promise<FeedEntry[]> {
    const beforeTx = before ? before.transactionIndex ?? 0 : undefined
    return feedProfile
      ? fetchFeed(feedProfile, pageSize, before?.blockNumber, beforeTx, before?.logIndex, feedChain, options)
      : fetchGlobalFeed(pageSize, before?.blockNumber, beforeTx, before?.logIndex, feedChain, options)
  }

  /**
   * Direct Stakingverse deposits (not indexed by Envio) between `lower`
   * (inclusive) and `before` (exclusive); null when the explorer failed. The
   * supplement is mainnet-only — both the explorer base URL and the vault
   * address it filters on are mainnet, so running it on another chain would
   * splice mainnet deposits into that feed.
   */
  async function fetchSupplement(before?: FeedEntry, lower?: FeedEntry): Promise<FeedEntry[] | null> {
    if (feedChain !== LUKSO_MAINNET_CHAIN_ID) return []
    return fetchStakingverseDepositEntries(
      feedProfile,
      pageSize,
      before?.blockNumber,
      before ? before.transactionIndex ?? 0 : undefined,
      before?.logIndex,
      lower?.blockNumber,
      lower?.transactionIndex ?? 0,
      lower?.logIndex,
      // A range that ends in the past may reuse an explorer response requested
      // after that range ended; an open-ended range needs a fresh one.
      { reuseFetchedAfterMs: before ? before.timestamp * 1000 : Number.POSITIVE_INFINITY },
    )
  }

  /** Put entries into `pending` (on top of the list, or into a pending replacement). */
  function stagePending(entries: FeedEntry[]) {
    const previous = pending.value
    if (previous?.replace) {
      // Nothing below the replacement's paging boundary: it would show up
      // with a hole above it once the replacement is applied.
      const boundary = oldestIndexedEntry(previous.entries)
      if (boundary) entries = entries.filter((entry) => compareFeedPosition(entry, boundary) >= 0)
    }
    if (!entries.length) return
    pending.value = previous
      ? { ...previous, entries: mergeAndSortEntries(entries, previous.entries) }
      : { entries: mergeAndSortEntries(entries, []), replace: false, hasMore: hasMore.value }
  }

  function olderOf(a: FeedEntry | undefined, b: FeedEntry | undefined): FeedEntry | undefined {
    if (!a) return b
    if (!b) return a
    return compareFeedPosition(a, b) <= 0 ? a : b
  }

  function noteChecked(upTo: FeedEntry | undefined) {
    if (upTo && (!checkedUpTo || compareFeedPosition(upTo, checkedUpTo) > 0)) checkedUpTo = upTo
  }

  /** Lower bound of the newest page among `entries` (newest first). */
  function newestPageBoundary(entries: readonly FeedEntry[]): FeedEntry | undefined {
    let seen = 0
    let boundary: FeedEntry | undefined
    for (const entry of entries) {
      if (isSupplementEntry(entry)) continue
      boundary = entry
      if (++seen >= pageSize) break
    }
    return boundary
  }

  /** Merge the supplement for a page that is already on screen. */
  async function supplementPage(
    requestGeneration: number,
    seq: number,
    before: FeedEntry | undefined,
    lower: FeedEntry | undefined,
    indexedCount: number,
    attempt = 0,
  ): Promise<void> {
    const upTo = before ? undefined : newestIndexedEntry(feedEntries.value)
    const entries = await fetchSupplement(before, lower)
    if (disposed || requestGeneration !== generation) return
    if (!entries) {
      if (attempt === 0) {
        setTimeout(() => {
          if (disposed || requestGeneration !== generation) return
          void supplementPage(requestGeneration, seq, before, lower, indexedCount, 1)
        }, SUPPLEMENT_RETRY_MS)
      }
      return
    }
    noteChecked(upTo)
    if (!entries.length) return
    if (seq === pageSeq) {
      if (entries.length >= pageSize) hasMore.value = true
      // A page without indexer rows pages on from its oldest explorer row.
      if (!indexedCount) cursor = entries[entries.length - 1]
    }
    // Rows below the cursor (e.g. a late answer after the list was trimmed)
    // come back with their page.
    const kept = cursor ? entries.filter((entry) => compareFeedPosition(entry, cursor!) >= 0) : entries
    if (kept.length) setEntries(mergeAndSortEntries(feedEntries.value, kept))
  }

  /**
   * Check the explorer for new deposits from `lower` up — by default from the
   * older of the newest page's bottom and the last check's top (everything if
   * nothing was checked yet). Rows older than the newest one on screen fill in
   * place; newer ones are staged in `pending` like any other new activity.
   */
  async function supplementNewest(requestGeneration: number, lower?: FeedEntry) {
    const known = pending.value ? mergeAndSortEntries(pending.value.entries, feedEntries.value) : feedEntries.value
    const from = lower ?? olderOf(newestPageBoundary(known), checkedUpTo ?? known[known.length - 1])
    // The global feed has no explorer query without a lower bound.
    if (!from && !feedProfile) return
    const upTo = newestIndexedEntry(known)
    const entries = await fetchSupplement(undefined, from)
    if (disposed || requestGeneration !== generation || !entries) return
    noteChecked(upTo)
    // A full answer may have cut older deposits off; let paging look further.
    if (entries.length >= pageSize) hasMore.value = true
    const current = pending.value ? mergeAndSortEntries(pending.value.entries, feedEntries.value) : feedEntries.value
    const knownKeys = new Set(current.map(feedEntryKey))
    const unseen = entries.filter((entry) => !knownKeys.has(feedEntryKey(entry)))
    if (!unseen.length) return
    const top = feedEntries.value[0]
    // Rows below everything loaded (shown or pending) come back with their page.
    const shown = feedEntries.value
    const pendingAdditions = pending.value && !pending.value.replace ? pending.value.entries : []
    const floor = olderOf(olderOf(cursor, shown[shown.length - 1]), pendingAdditions[pendingAdditions.length - 1])
    const above = top ? unseen.filter((entry) => compareFeedPosition(entry, top) > 0) : unseen
    const within = top
      ? unseen.filter((entry) => compareFeedPosition(entry, top) <= 0 && (!floor || compareFeedPosition(entry, floor) >= 0))
      : []
    if (within.length) setEntries(mergeAndSortEntries(feedEntries.value, within))
    stagePending(above)
  }

  /** Load the newest page from scratch, or the next older page. */
  async function loadPage(kind: 'first' | 'more') {
    const requestGeneration = generation
    const before = kind === 'more' ? cursor : undefined
    const indexed = await fetchIndexedPage(before)
    if (disposed || requestGeneration !== generation) return

    const seq = ++pageSeq
    const lower = indexed[indexed.length - 1]
    hasMore.value = indexed.length >= pageSize
    if (lower) cursor = lower

    // Show the indexer rows right away; merge the explorer rows when they come.
    if (kind === 'first') {
      enrichedIdentities.value = {}
      mergeEnrichedIdentities(indexed)
      setEntries(mergeAndSortEntries(indexed, []))
    } else if (indexed.length) {
      mergeEnrichedIdentities(indexed)
      setEntries(mergeAndSortEntries(feedEntries.value, indexed))
    }

    const supplement = supplementPage(requestGeneration, seq, before, lower, indexed.length)
    // Without indexer rows the supplement is all there is; wait for it rather
    // than flashing the empty state.
    if (!indexed.length) await supplement
  }

  function start() {
    generation++
    pageSeq++
    if (cacheWriteTimer) clearTimeout(cacheWriteTimer)
    cacheWriteTimer = null
    inflightPoll = null
    pending.value = null
    checkedUpTo = undefined
    pagingFailed = false
    cursor = undefined
    loadingMore.value = false
    error.value = null
    feedChain = readChain()
    feedProfile = readProfile()

    if (startFromCache()) return

    feedEntries.value = []
    enrichedIdentities.value = {}
    hasMore.value = true
    loading.value = true
    const requestGeneration = generation
    loadPage('first')
      .catch((e) => {
        if (requestGeneration !== generation) return
        error.value = e instanceof Error ? e : new Error(String(e))
        console.error('[useFeedApi] load failed:', e)
      })
      .finally(() => {
        if (requestGeneration === generation) loading.value = false
      })
  }

  /** Show the cached copy of this feed and revalidate it; false on a miss. */
  function startFromCache(): boolean {
    const cached = readFeedCache(feedChain, feedProfile)
    if (!cached) return false
    try {
      enrichedIdentities.value = extractEnrichedIdentities(cached.entries)
      cursor = oldestIndexedEntry(cached.entries) ?? cached.entries[cached.entries.length - 1]
    } catch (e) {
      console.warn('[useFeedApi] ignoring unusable cache:', e)
      cursor = undefined
      return false
    }
    feedEntries.value = cached.entries
    hasMore.value = cached.hasMore
    loading.value = false
    const revalidateGeneration = generation
    // The cached rows may have been saved before their explorer check
    // finished, so the whole cached range is re-checked.
    const cachedRangeStart = cached.entries[cached.entries.length - 1]
    // Revalidate with the newest page: index.html has usually started that
    // exact request already.
    void poll(true).then(() => {
      if (disposed || revalidateGeneration !== generation) return
      // A replacement brings its own supplement when it is applied.
      if (!pending.value?.replace) void supplementNewest(revalidateGeneration, cachedRangeStart)
    })
    return true
  }

  async function loadMore() {
    if (loadingMore.value || loading.value || !hasMore.value) return
    const requestGeneration = generation
    loadingMore.value = true
    try {
      await loadPage('more')
    } catch (e) {
      if (requestGeneration !== generation) return
      console.error('[useFeedApi] loadMore failed:', e)
      // Hide the sentinel — the cursor wasn't advanced, so the
      // IntersectionObserver would otherwise loop the same failing fetch. The
      // next successful poll or refresh re-enables paging (see recoverPaging).
      hasMore.value = false
      pagingFailed = true
      pageSeq++ // an earlier page's late supplement must not reopen paging
    } finally {
      if (requestGeneration === generation) loadingMore.value = false
    }
  }

  function recoverPaging() {
    if (!pagingFailed) return
    pagingFailed = false
    hasMore.value = true
  }

  async function runPoll(newestPage: boolean) {
    const requestGeneration = generation
    const known = pending.value
      ? mergeAndSortEntries(pending.value.entries, feedEntries.value)
      : feedEntries.value
    const newestKnown = newestIndexedEntry(known)

    // `newestPage` (cache revalidation) asks for the plain newest page, which
    // index.html has usually started already. Timed polls look past the
    // indexer's response cache instead. The global feed then asks for just the
    // rows after the newest known one — with room for two pages, as the cached
    // first page can be minutes old; profile_feed has no lower bound, so profile
    // feeds re-read their newest page.
    const pollOptions = newestPage ? undefined : { cacheWindowMs: POLL_CACHE_WINDOW_MS }
    const afterLimit = pageSize * 2
    const useAfter = !feedProfile && !!newestKnown && !newestPage
    const page = useAfter
      ? await fetchGlobalFeedAfter(afterLimit, newestKnown!, feedChain, pollOptions)
      : await fetchIndexedPage(undefined, pollOptions)
    if (disposed || requestGeneration !== generation) return
    recoverPaging()

    // An "after" page holds only new rows: shorter than its limit means it connects.
    const { fresh, contiguous } = spliceNewestPage(known, page, useAfter ? afterLimit : pageSize)
    if (!contiguous) {
      // Too much new activity to connect to the list: the newest page replaces it.
      if (page.length) pending.value = { entries: page, replace: true, hasMore: page.length >= pageSize }
    } else {
      stagePending(fresh)
    }

    // Profile feeds re-check the explorer on every timed poll, as they did
    // before polling was incremental (a profile's explorer list is small). The
    // global feed's vault list is ~1.7 MB, so it is only re-checked on refresh
    // and on the next visit.
    if (feedProfile && !newestPage) await supplementNewest(requestGeneration)
  }

  function poll(newestPage = false): Promise<void> {
    if (loading.value || disposed) return Promise.resolve()
    if (!inflightPoll) {
      const requestGeneration = generation
      inflightPoll = runPoll(newestPage)
        .catch((e) => {
          if (requestGeneration === generation) console.warn('[useFeedApi] poll failed:', e)
        })
        .finally(() => {
          if (requestGeneration === generation) inflightPoll = null
        })
    }
    return inflightPoll
  }

  function applyPending(options: ApplyPendingOptions = {}) {
    const update = pending.value
    if (!update) return
    pending.value = null

    if (update?.replace) {
      generation++ // drop in-flight pages, polls and supplements of the old list
      const seq = ++pageSeq
      inflightPoll = null
      loadingMore.value = false
      pagingFailed = false
      error.value = null
      const entries = mergeAndSortEntries(update.entries, [])
      const lower = oldestIndexedEntry(entries)
      cursor = lower ?? entries[entries.length - 1]
      hasMore.value = update.hasMore
      checkedUpTo = undefined // the new page's range is checked below
      enrichedIdentities.value = extractEnrichedIdentities(entries)
      setEntries(entries)
      void supplementPage(generation, seq, undefined, lower, entries.length)
      return
    }

    error.value = null
    mergeEnrichedIdentities(update.entries)
    // Rows can land below the cursor when the list held only explorer rows.
    const oldestAdded = update.entries[update.entries.length - 1]
    if (cursor && oldestAdded && compareFeedPosition(oldestAdded, cursor) < 0) cursor = oldestAdded
    let entries = mergeAndSortEntries(update.entries, feedEntries.value)
    if (options.trim && entries.length > LIVE_MAX_ENTRIES && !loadingMore.value) {
      entries = entries.slice(0, LIVE_KEEP_ENTRIES)
      pageSeq++ // older pages' supplements must not move the new cursor
      cursor = oldestIndexedEntry(entries) ?? entries[entries.length - 1]
      hasMore.value = true
      enrichedIdentities.value = extractEnrichedIdentities(entries)
    }
    setEntries(entries)
  }

  async function refresh() {
    if (loading.value || disposed) return
    const requestGeneration = generation
    await poll()
    if (disposed || requestGeneration !== generation) return
    recoverPaging()
    await supplementNewest(requestGeneration)
  }

  // Initial load, and a fresh start when the profile or the chain changes — the
  // profile selects a different feed, the chain selects both a different feed
  // and a different indexer endpoint.
  start()
  const reactiveSources = [profileId, chainId].filter(isRef)
  if (reactiveSources.length > 0) {
    watch(reactiveSources, () => start())
  }

  // An unmounted feed (e.g. after navigating to another route record) must not
  // keep writing state or the cache when its last requests resolve.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      generation++
      if (cacheWriteTimer) clearTimeout(cacheWriteTimer)
      cacheWriteTimer = null
    })
  }

  return {
    feedEntries: feedEntries as Ref<FeedEntry[]>,
    loading,
    loadingMore,
    error,
    hasMore,
    enrichedIdentities: enrichedIdentities as Ref<Record<string, any>>,
    pending: pending as Ref<PendingFeedUpdate | null>,
    loadMore,
    poll,
    refresh,
    applyPending,
    reload: start,
  }
}
