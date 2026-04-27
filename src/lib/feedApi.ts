import type { FeedEntry } from './feedTypes'

const FEED_API_URL = 'https://envio.lukso-mainnet.universal.tech/v1/graphql'

const FEED_FIELDS = `
  id
  blockNumber
  transactionHash
  transactionIndex
  logIndex
  address
  eventType
  dataKey
  decoded
  timestamp
  profileArgs(limit: 3) {
    profile {
      id
      name
      profileImages(order_by: {width: desc}, where: { error: { _is_null: true } }, limit: 1) {
        src
        width
        height
      }
    }
  }
  assetArgs(limit: 3) {
    asset {
      id
      name
      lsp4TokenName
      lsp4TokenSymbol
      lsp4TokenType
      decimals
      owner_id
      icons(order_by: {width: desc}, where: { error: { _is_null: true } }, limit: 1) {
        src
        width
        height
      }
      images(order_by: {width: desc}, where: { index: { _eq: 0 }, error: { _is_null: true } }, limit: 1) {
        src
        width
        height
      }
      lsp4Creators(limit: 1) {
        profile_id
      }
    }
  }
`

async function graphqlQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(FEED_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    throw new Error(`Feed API error: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(`Feed API GraphQL error: ${json.errors[0].message}`)
  }
  return json.data
}

import { JSONbigString } from '@lukso/transaction-decoder'

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

function parseFeedEntries(raw: any[]): FeedEntry[] {
  return raw.map((entry) => ({
    ...entry,
    decoded: parseDecoded(entry.decoded, entry.id),
    profileArgs: entry.profileArgs || [],
    assetArgs: entry.assetArgs || [],
  }))
}

/**
 * Build cursor pagination condition for (blockNumber, transactionIndex, logIndex) tuple.
 * The full tuple is required because logIndex is tx-local per the schema docstring —
 * two txs in the same block can collide on logIndex and silently skip rows on page
 * boundaries. Returns a fragment to splice into a _and array, or empty string.
 */
function buildCursorCondition(
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
): string {
  if (beforeBlock == null) return ''
  const txIdx = beforeTransactionIndex ?? 0
  const logIdx = beforeLogIndex ?? 0
  return `, { _or: [
    { blockNumber: { _lt: ${beforeBlock} } },
    { blockNumber: { _eq: ${beforeBlock} }, transactionIndex: { _lt: ${txIdx} } },
    { blockNumber: { _eq: ${beforeBlock} }, transactionIndex: { _eq: ${txIdx} }, logIndex: { _lt: ${logIdx} } }
  ] }`
}

/**
 * Fetch paginated feed for a specific profile.
 *
 * The `_or` has four arms to work around indexer gaps documented in
 * PROFILE-FEED-COVERAGE-ANALYSIS.md:
 *  - `profiles` / `profileArgs`: the canonical relation joins (unreliable — ~32% of
 *     lsp7_transfer rows have empty `profiles` arrays)
 *  - `address`: catches events emitted by the UP itself (profile edits, permission
 *     changes) that the relation arms never cover
 *  - `decoded _cast String _ilike`: last-resort substring match over the stringified
 *     JSON payload to recover rows where the indexer failed to write the relation
 *     joins. `decoded` is jsonb but the indexer stores it as a stringified scalar,
 *     so `_contains` won't work — we cast to text and ilike the raw address hex.
 */
export async function fetchFeed(
  profileId: string,
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
): Promise<FeedEntry[]> {
  const cursorCondition = buildCursorCondition(beforeBlock, beforeTransactionIndex, beforeLogIndex)
  const lowerId = profileId.toLowerCase()

  const query = `
    query ProfileFeed($profileId: String!, $profileIdPattern: String!) {
      Feed(
        limit: ${limit},
        where: {
          _and: [
            { _or: [
              { profiles: { profile_id: { _eq: $profileId } } },
              { profileArgs: { profile_id: { _eq: $profileId } } },
              { address: { _eq: $profileId } },
              { decoded: { _cast: { String: { _ilike: $profileIdPattern } } } }
            ] }
            ${cursorCondition}
          ]
        },
        order_by: [{ blockNumber: desc }, { transactionIndex: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  const data = await graphqlQuery<{ Feed: any[] }>(query, {
    profileId: lowerId,
    // Wrap in JSON quotes so the pattern matches only exact string values in the
    // decoded payload (e.g. `"0xabc..."`) — not substrings inside URL fragments
    // like `https://.../#address=0xabc...` that appear in grid_updated events.
    profileIdPattern: `%"${lowerId}"%`,
  })
  return parseFeedEntries(data.Feed)
}

/**
 * Fetch global feed (all activity, no profile filter).
 */
export async function fetchGlobalFeed(
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
): Promise<FeedEntry[]> {
  const cursorCondition = buildCursorCondition(beforeBlock, beforeTransactionIndex, beforeLogIndex)

  // For global feed without cursor, skip the where clause entirely
  const whereClause = cursorCondition
    ? `where: { _and: [${cursorCondition.replace(/^,\s*/, '')}] },`
    : ''

  const query = `
    query GlobalFeed {
      Feed(
        limit: ${limit},
        ${whereClause}
        order_by: [{ blockNumber: desc }, { transactionIndex: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  const data = await graphqlQuery<{ Feed: any[] }>(query, {})
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
    if (entry.profileArgs) {
      for (const { profile } of entry.profileArgs) {
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
    if (entry.assetArgs) {
      for (const { asset } of entry.assetArgs) {
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
