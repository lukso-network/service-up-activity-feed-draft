// Pure helpers for ordering, merging and splicing feed entries. Kept free of Vue
// so the live-update rules (merge on top vs. replace after a gap) are easy to
// reason about and test in isolation.

import type { FeedEntry } from './feedTypes'

/** Rows the Stakingverse explorer supplement adds; their logIndex is synthetic (-1). */
export function isSupplementEntry(entry: FeedEntry): boolean {
  return entry.id.startsWith('stakingverse:')
}

/**
 * Identity used to de-duplicate entries across pages, polls and the explorer
 * supplement. One entry per transaction, as introduced with the Stakingverse
 * supplement: the first occurrence wins.
 */
export function feedEntryKey(entry: FeedEntry): string {
  return entry.transactionHash || entry.id
}

/** > 0 when `a` is newer than `b`, < 0 when older, 0 for the same position. */
export function compareFeedPosition(a: FeedEntry, b: FeedEntry): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber
  const aTx = a.transactionIndex ?? 0
  const bTx = b.transactionIndex ?? 0
  if (aTx !== bTx) return aTx - bTx
  return a.logIndex - b.logIndex
}

/** De-duplicate (earlier arguments win) and sort newest first. */
export function mergeAndSortEntries(primary: readonly FeedEntry[], secondary: readonly FeedEntry[]): FeedEntry[] {
  const seen = new Set<string>()
  const merged: FeedEntry[] = []

  for (const entry of [...primary, ...secondary]) {
    const key = feedEntryKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }

  return merged.sort((a, b) => compareFeedPosition(b, a))
}

/** Newest indexer (non-supplement) entry of a newest-first list. */
export function newestIndexedEntry(entries: readonly FeedEntry[]): FeedEntry | undefined {
  return entries.find((entry) => !isSupplementEntry(entry))
}

/** Oldest indexer (non-supplement) entry of a newest-first list — the paging cursor. */
export function oldestIndexedEntry(entries: readonly FeedEntry[]): FeedEntry | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!isSupplementEntry(entries[i])) return entries[i]
  }
  return undefined
}

export interface NewestPageSplice {
  /** Entries newer than everything already known, not yet present. */
  fresh: FeedEntry[]
  /**
   * True when `page` reaches back to the known entries, so `fresh` can be put
   * on top without leaving a hole. False means more new rows exist than one
   * page holds: the page has to replace the list instead.
   */
  contiguous: boolean
}

/**
 * Compare a newest-first page from the indexer with what is already known
 * (rendered and pending entries, newest first).
 *
 * The page connects to the known entries when it contains a row at or below the
 * newest known indexer row, or when it is shorter than a full page (it then holds
 * everything newer than its lower bound).
 */
export function spliceNewestPage(
  known: readonly FeedEntry[],
  page: readonly FeedEntry[],
  pageSize: number,
): NewestPageSplice {
  const knownKeys = new Set(known.map(feedEntryKey))
  const newestKnown = newestIndexedEntry(known)
  if (!newestKnown) {
    if (!known.length) return { fresh: [...page], contiguous: false }
    // Only explorer rows are known (a profile with nothing indexed yet). Their
    // positions say nothing about which indexer rows exist, so every unknown
    // row is new — a short page is the profile's whole indexed history.
    return {
      fresh: page.filter((entry) => !knownKeys.has(feedEntryKey(entry))),
      contiguous: page.length < pageSize,
    }
  }

  const fresh = page.filter(
    (entry) => compareFeedPosition(entry, newestKnown) > 0 && !knownKeys.has(feedEntryKey(entry)),
  )
  const contiguous = page.length < pageSize || page.some((entry) => compareFeedPosition(entry, newestKnown) <= 0)
  return { fresh, contiguous }
}
