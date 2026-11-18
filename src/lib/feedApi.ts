import type { FeedEntry } from './feedTypes'
import { feedApiUrl } from './chains'
import { JSONbigString } from './jsonBigint'
import {
  buildGlobalFeedRequest,
  buildGlobalFeedAfterRequest,
  buildProfileFeedRequest,
  serializeGraphqlRequest,
  withCacheWindow,
  type GraphqlRequest,
} from './feedQuery'
import { takePrefetchedResponse, type PrefetchedResponse } from '../prefetch/feedPrefetchShared'

function readGraphqlData<T>(json: any): T {
  if (json.errors?.length) {
    throw new Error(`Feed API GraphQL error: ${json.errors[0].message}`)
  }
  return json.data
}

/** Data from the index.html prefetch, or undefined when it can't be used as-is. */
function readPrefetchedData<T>(prefetched: PrefetchedResponse | null): T | undefined {
  if (!prefetched?.ok) return undefined
  try {
    const json = JSON.parse(prefetched.text)
    if (json.errors?.length || !json.data) return undefined
    return json.data
  } catch {
    return undefined
  }
}

export interface FeedRequestOptions {
  /**
   * Bypass the indexer's response cache at this granularity (see
   * withCacheWindow). For polls; page loads use the shared cached response.
   */
  cacheWindowMs?: number
}

async function graphqlQuery<T>(
  request: GraphqlRequest,
  chainId?: number,
  options: FeedRequestOptions = {},
): Promise<T> {
  const url = feedApiUrl(chainId)
  const body = serializeGraphqlRequest(
    options.cacheWindowMs ? withCacheWindow(request, options.cacheWindowMs) : request,
  )

  // The newest page may already be in flight from index.html. A failed or
  // unusable prefetch falls through to a regular request.
  const prefetched = takePrefetchedResponse(url, body)
  if (prefetched) {
    const data = readPrefetchedData<T>(await prefetched)
    if (data) return data
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Feed API error: ${res.status} ${res.statusText}`)
  }
  return readGraphqlData<T>(await res.json())
}

// The indexer occasionally emits unescaped control bytes (raw \n, \t, etc.) inside
// JSON string literals — see e.g. profile bios with newlines. JSON.parse rejects
// those, so we walk the string and escape control chars only when inside a string
// literal. Falling through to dropping the row would stall pagination on the
// offending cursor and spin the loading indicator forever.
function sanitizeJsonControlChars(s: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const code = ch.charCodeAt(0)
    if (escape) { out += ch; escape = false; continue }
    if (inString && ch === '\\') { out += ch; escape = true; continue }
    if (ch === '"') { inString = !inString; out += ch; continue }
    if (inString && code < 0x20) {
      if (code === 0x0a) out += '\\n'
      else if (code === 0x0d) out += '\\r'
      else if (code === 0x09) out += '\\t'
      else if (code === 0x08) out += '\\b'
      else if (code === 0x0c) out += '\\f'
      else out += '\\u' + code.toString(16).padStart(4, '0')
      continue
    }
    out += ch
  }
  return out
}

function parseDecoded(value: unknown, entryId?: string): unknown {
  try {
    if (typeof value === 'string') return JSONbigString.parse(value)
    if (typeof value === 'object' && value !== null) return JSONbigString.read(value)
    return value
  } catch (e) {
    if (typeof value === 'string') {
      try {
        return JSONbigString.parse(sanitizeJsonControlChars(value))
      } catch (e2) {
        console.warn('[feedApi] decoded parse failed for', entryId, e2)
        return undefined
      }
    }
    console.warn('[feedApi] decoded parse failed for', entryId, e)
    return undefined
  }
}

/** Relationship lists without null or malformed elements. */
export function cleanRelationshipArgs<T>(args: unknown): T[] {
  return Array.isArray(args) ? args.filter((arg) => !!arg && typeof arg === 'object') : []
}

function parseFeedEntries(raw: any[]): FeedEntry[] {
  return raw.map((entry) => ({
    ...entry,
    decoded: parseDecoded(entry.decoded, entry.id),
    profileArgs: cleanRelationshipArgs(entry.profileArgs),
    assetArgs: cleanRelationshipArgs(entry.assetArgs),
  }))
}

/**
 * Fetch paginated feed for a specific profile.
 *
 * Backed by the indexer's `profile_feed` Postgres function, which resolves profile
 * membership through indexed relations and returns plain Feed rows already ordered
 * by (blockNumber, transactionIndex, logIndex) descending. This replaces the old
 * four-arm `_or` where-clause, whose `decoded _cast String _ilike` arm did an
 * unindexed substring scan over every stringified JSON payload.
 */
export async function fetchFeed(
  profileId: string,
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
  chainId?: number,
  options?: FeedRequestOptions,
): Promise<FeedEntry[]> {
  const data = await graphqlQuery<{ profile_feed: any[] }>(
    buildProfileFeedRequest(profileId, limit, beforeBlock, beforeTransactionIndex, beforeLogIndex),
    chainId,
    options,
  )
  return parseFeedEntries(data.profile_feed)
}

/**
 * Fetch global feed (all activity, no profile filter).
 */
export async function fetchGlobalFeed(
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
  chainId?: number,
  options?: FeedRequestOptions,
): Promise<FeedEntry[]> {
  const data = await graphqlQuery<{ Feed: any[] }>(
    buildGlobalFeedRequest(limit, beforeBlock, beforeTransactionIndex, beforeLogIndex),
    chainId,
    options,
  )
  return parseFeedEntries(data.Feed)
}

/**
 * Fetch global rows strictly newer than the given position, newest first (at
 * most `limit`). Used for live polling.
 */
export async function fetchGlobalFeedAfter(
  limit: number,
  after: { blockNumber: number; transactionIndex?: number; logIndex: number },
  chainId?: number,
  options?: FeedRequestOptions,
): Promise<FeedEntry[]> {
  const data = await graphqlQuery<{ Feed: any[] }>(
    buildGlobalFeedAfterRequest(limit, after.blockNumber, after.transactionIndex ?? 0, after.logIndex),
    chainId,
    options,
  )
  return parseFeedEntries(data.Feed)
}

/**
 * Extract pre-loaded identity data from enriched feed entries.
 * Returns a map of address → identity object matching AddressIdentity shape,
 * ready to be merged into the address resolver cache.
 */
export function extractEnrichedIdentities(entries: FeedEntry[]): Record<string, any> {
  const identities: Record<string, any> = {}

  for (const entry of entries) {
    // Extract profile identities from profileArgs
    if (Array.isArray(entry.profileArgs)) {
      for (const arg of entry.profileArgs) {
        const profile = arg?.profile
        if (!profile?.id) continue
        const addr = profile.id.toLowerCase()
        if (identities[addr]) continue // first occurrence wins
        identities[addr] = {
          address: addr,
          name: profile.name || undefined,
          profileImages: profile.profileImages || [],
          __gqltype: 'Profile',
        }
      }
    }

    // Extract asset identities from assetArgs
    if (Array.isArray(entry.assetArgs)) {
      for (const arg of entry.assetArgs) {
        const asset = arg?.asset
        if (!asset?.id) continue
        const addr = asset.id.toLowerCase()
        if (identities[addr]) continue
        identities[addr] = {
          address: addr,
          name: asset.name || undefined,
          lsp4TokenName: asset.lsp4TokenName || undefined,
          lsp4TokenSymbol: asset.lsp4TokenSymbol || undefined,
          lsp4TokenType: asset.lsp4TokenType ?? undefined,
          decimals: asset.decimals ?? undefined,
          owner_id: asset.owner_id || undefined,
          icons: asset.icons || [],
          images: asset.images || [],
          lsp4Creators: asset.lsp4Creators || [],
          __gqltype: 'Asset',
        }
      }
    }
  }

  return identities
}
