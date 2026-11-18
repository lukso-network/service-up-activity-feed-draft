// Last-seen feed per (chain, profile) in localStorage, so a returning viewer
// sees the feed immediately while the newest page is fetched in the background
// (stale-while-revalidate).
//
// Storage is best effort: inside a cross-origin iframe it is partitioned per
// embedding site and may be blocked or cleared at any time, so every access is
// guarded and a miss just means a normal first load.

import type { FeedEntry } from './feedTypes'
import { JSONbigString } from './jsonBigint'
import { cleanRelationshipArgs } from './feedApi'

const KEY_PREFIX = 'up-activity-feed:v1:'
const INDEX_KEY = `${KEY_PREFIX}index`

/** Enough rows to fill the first screen even when many of them get grouped. */
const MAX_CACHED_ENTRIES = 50
/** Global and profile feeds kept at most; least recently written are evicted. */
const MAX_CACHED_FEEDS = 6
/** Global activity is stale quickly; a profile's history stays valid much longer. */
const GLOBAL_MAX_AGE_MS = 6 * 60 * 60 * 1000
const PROFILE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

interface StoredFeed {
  savedAt: number
  hasMore: boolean
  /** Entries serialised with BigInt values as "123n" strings. */
  entries: string
}

export interface CachedFeed {
  savedAt: number
  hasMore: boolean
  entries: FeedEntry[]
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined // Access itself throws when storage is blocked.
  }
}

function feedKey(chainId: number, profileId?: string): string {
  return `${KEY_PREFIX}${chainId}:${profileId ? profileId.toLowerCase() : 'global'}`
}

function readIndex(store: Storage): string[] {
  try {
    const parsed = JSON.parse(store.getItem(INDEX_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function readFeedCache(chainId: number, profileId?: string, now = Date.now()): CachedFeed | null {
  const store = storage()
  if (!store) return null
  const key = feedKey(chainId, profileId)
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredFeed
    const maxAge = profileId ? PROFILE_MAX_AGE_MS : GLOBAL_MAX_AGE_MS
    if (typeof stored.savedAt !== 'number' || now - stored.savedAt > maxAge) {
      store.removeItem(key)
      return null
    }
    const rows: unknown = JSON.parse(stored.entries)
    if (!Array.isArray(rows) || !rows.length || !rows.every(isFeedEntryShape)) {
      store.removeItem(key)
      return null
    }
    const entries = (rows as FeedEntry[]).map((entry) => ({
      ...entry,
      // Only `decoded` carries BigInt values (see parseDecoded in feedApi.ts).
      decoded: JSONbigString.read(entry.decoded),
      profileArgs: cleanRelationshipArgs<NonNullable<FeedEntry['profileArgs']>[number]>(entry.profileArgs),
      assetArgs: cleanRelationshipArgs<NonNullable<FeedEntry['assetArgs']>[number]>(entry.assetArgs),
    }))
    return { savedAt: stored.savedAt, hasMore: stored.hasMore !== false, entries }
  } catch {
    return null
  }
}

/** The fields the feed relies on for ordering, keys and paging. */
function isFeedEntryShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && typeof entry.transactionHash === 'string'
    && typeof entry.eventType === 'string'
    && Number.isSafeInteger(entry.blockNumber)
    && Number.isSafeInteger(entry.logIndex)
    && (entry.transactionIndex == null || Number.isSafeInteger(entry.transactionIndex))
    && typeof entry.timestamp === 'number'
}

export function writeFeedCache(
  chainId: number,
  profileId: string | undefined,
  entries: readonly FeedEntry[],
  hasMore: boolean,
  now = Date.now(),
): void {
  const store = storage()
  if (!store || !entries.length) return
  const key = feedKey(chainId, profileId)
  const kept = entries.slice(0, MAX_CACHED_ENTRIES)

  let value: string
  try {
    const stored: StoredFeed = {
      savedAt: now,
      // Dropping the older rows means there is more to page through.
      hasMore: hasMore || entries.length > kept.length,
      entries: JSON.stringify(kept, (_k, v) => (typeof v === 'bigint' ? `${v.toString()}n` : v)),
    }
    value = JSON.stringify(stored)
  } catch {
    return
  }

  const index = readIndex(store).filter((k) => k !== key)
  index.unshift(key)
  // Evict least recently written feeds, then retry once more per eviction when
  // the quota is hit.
  while (index.length > MAX_CACHED_FEEDS) removeQuietly(store, index.pop()!)
  for (;;) {
    try {
      store.setItem(key, value)
      store.setItem(INDEX_KEY, JSON.stringify(index))
      return
    } catch {
      const victim = index.length > 1 ? index.pop() : undefined
      if (!victim) return
      removeQuietly(store, victim)
    }
  }
}

function removeQuietly(store: Storage, key: string): void {
  try {
    store.removeItem(key)
  } catch {
    // ignore
  }
}
