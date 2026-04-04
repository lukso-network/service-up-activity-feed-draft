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

function parseFeedEntries(raw: any[]): FeedEntry[] {
  return raw.map((entry) => ({
    ...entry,
    decoded: typeof entry.decoded === 'string' ? JSON.parse(entry.decoded) : entry.decoded,
  }))
}

/**
 * Fetch paginated feed for a specific profile.
 * Uses blockNumber + logIndex as cursor for pagination.
 */
export async function fetchFeed(
  profileId: string,
  limit: number,
  beforeBlock?: number,
  beforeLogIndex?: number,
): Promise<FeedEntry[]> {
  // Build cursor condition: entries before a given (blockNumber, logIndex) pair
  const cursorWhere = beforeBlock != null
    ? `, _or: [
        { blockNumber: { _lt: ${beforeBlock} } },
        { blockNumber: { _eq: ${beforeBlock} }, logIndex: { _lt: ${beforeLogIndex ?? 0} } }
      ]`
    : ''

  const query = `
    query ProfileFeed($profileId: String!) {
      Feed(
        limit: ${limit},
        where: {
          profiles: { profile_id: { _eq: $profileId } }
          ${cursorWhere}
        },
        order_by: [{ blockNumber: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  const data = await graphqlQuery<{ Feed: any[] }>(query, { profileId: profileId.toLowerCase() })
  if (data.Feed.length > 0) return parseFeedEntries(data.Feed)

  // Fallback: also try profileArgs (the profile might be referenced in events, not the emitter)
  const fallbackQuery = `
    query ProfileArgsFeed($profileId: String!) {
      Feed(
        limit: ${limit},
        where: {
          profileArgs: { profile_id: { _eq: $profileId } }
          ${cursorWhere}
        },
        order_by: [{ blockNumber: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  const fallback = await graphqlQuery<{ Feed: any[] }>(fallbackQuery, { profileId: profileId.toLowerCase() })
  return parseFeedEntries(fallback.Feed)
}

/**
 * Fetch global feed (all activity, no profile filter).
 */
export async function fetchGlobalFeed(
  limit: number,
  beforeBlock?: number,
  beforeLogIndex?: number,
): Promise<FeedEntry[]> {
  const cursorWhere = beforeBlock != null
    ? `where: {
        _or: [
          { blockNumber: { _lt: ${beforeBlock} } },
          { blockNumber: { _eq: ${beforeBlock} }, logIndex: { _lt: ${beforeLogIndex ?? 0} } }
        ]
      },`
    : ''

  const query = `
    query GlobalFeed {
      Feed(
        limit: ${limit},
        ${cursorWhere}
        order_by: [{ blockNumber: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  const data = await graphqlQuery<{ Feed: any[] }>(query, {})
  return parseFeedEntries(data.Feed)
}
