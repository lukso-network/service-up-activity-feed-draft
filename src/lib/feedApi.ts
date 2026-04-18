import type { FeedEntry } from './feedTypes'

const FEED_API_URL = 'https://envio.lukso-mainnet.universal.tech/v1/graphql'

const FEED_FIELDS = `
  id
  blockNumber
  transactionHash
  logIndex
  transactionIndex
  address
  eventType
  dataKey
  decoded
  timestamp
  profileArgs(limit: 3) {
    profile {
      id
      name
      standard
      isEOA
      profileImages(order_by: {width: desc}, where: { error: { _is_null: true } }, limit: 1) {
        src
        width
        height
      }
      tags
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
      lsp8TokenIdFormat
      isLSP7
      isCollection
      standard
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
      lsp4Creators(limit: 3) {
        profile_id
      }
    }
  }
  tokenArgs(limit: 3) {
    token {
      id
      tokenId
      name
      lsp4TokenName
      asset_id
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

function parseFeedEntries(raw: any[]): FeedEntry[] {
  return raw.map((entry) => {
    // Standardize decoded JSON parsing via JSONbigString to handle '1000n' automatically into actual BigInts
    const decoded = typeof entry.decoded === 'string'
      ? JSONbigString.parse(entry.decoded)
      : typeof entry.decoded === 'object'
        ? JSONbigString.read(entry.decoded)
        : entry.decoded

    return {
      ...entry,
      decoded,
      // Preserve enriched relationship data
      profileArgs: entry.profileArgs || [],
      assetArgs: entry.assetArgs || [],
      tokenArgs: entry.tokenArgs || [],
    }
  })
}

/**
 * Build cursor pagination condition for (blockNumber, logIndex) pair.
 * Returns a fragment to splice into a _and array, or empty string.
 */
function buildCursorCondition(beforeBlock?: number, beforeLogIndex?: number): string {
  if (beforeBlock == null) return ''
  return `, { _or: [
    { blockNumber: { _lt: ${beforeBlock} } },
    { blockNumber: { _eq: ${beforeBlock} }, logIndex: { _lt: ${beforeLogIndex ?? 0} } }
  ] }`
}

/**
 * Fetch paginated feed for a specific profile.
 * Uses a combined query that matches entries where the profile is either
 * the feed owner (profiles) OR a referenced participant (profileArgs),
 * eliminating the need for sequential fallback queries.
 */
export async function fetchFeed(
  profileId: string,
  limit: number,
  beforeBlock?: number,
  beforeLogIndex?: number,
): Promise<FeedEntry[]> {
  const cursorCondition = buildCursorCondition(beforeBlock, beforeLogIndex)

  const query = `
    query ProfileFeed($profileId: String!) {
      Feed(
        limit: ${limit},
        where: {
          _and: [
            { _or: [
              { profiles: { profile_id: { _eq: $profileId } } },
              { profileArgs: { profile_id: { _eq: $profileId } } }
            ] }
            ${cursorCondition}
          ]
        },
        order_by: [{ blockNumber: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  const data = await graphqlQuery<{ Feed: any[] }>(query, { profileId: profileId.toLowerCase() })
  return parseFeedEntries(data.Feed)
}

/**
 * Fetch global feed (all activity, no profile filter).
 */
export async function fetchGlobalFeed(
  limit: number,
  beforeBlock?: number,
  beforeLogIndex?: number,
): Promise<FeedEntry[]> {
  const cursorCondition = buildCursorCondition(beforeBlock, beforeLogIndex)

  // For global feed without cursor, skip the _and wrapper entirely
  const whereClause = cursorCondition
    ? `where: {
        _and: [
          { _or: [
            { blockNumber: { _lt: ${beforeBlock} } },
            { blockNumber: { _eq: ${beforeBlock} }, logIndex: { _lt: ${beforeLogIndex ?? 0} } }
          ] }
        ]
      },`
    : ''

  const query = `
    query GlobalFeed {
      Feed(
        limit: ${limit},
        ${whereClause}
        order_by: [{ blockNumber: desc }, { logIndex: desc }]
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
          standard: profile.standard || undefined,
          isEOA: profile.isEOA || false,
          profileImages: profile.profileImages || [],
          tags: profile.tags || [],
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
          lsp8TokenIdFormat: asset.lsp8TokenIdFormat ?? undefined,
          isLSP7: asset.isLSP7 || false,
          isCollection: asset.isCollection || false,
          standard: asset.standard || undefined,
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
