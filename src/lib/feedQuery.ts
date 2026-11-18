// Envio feed GraphQL request builders.
//
// This module is dependency-free on purpose: besides the app, vite.config.ts
// imports it at build time to bake the first-page request into the inline
// prefetch script in index.html. The prefetched response is only reused when
// the app later builds a byte-identical request body, so both sides must build
// requests through these functions.

/** Rows per feed page. Shared by the app and the inline prefetch. */
export const FEED_PAGE_SIZE = 25

export const FEED_FIELDS = `
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

export interface GraphqlRequest {
  query: string
  variables: Record<string, unknown>
}

/** The exact POST body for a request; prefetch reuse compares these strings. */
export function serializeGraphqlRequest(request: GraphqlRequest): string {
  return JSON.stringify({ query: request.query, variables: request.variables })
}

/**
 * The indexer's HTTP layer caches responses by request body for about five
 * minutes, so re-sending an identical poll keeps returning the first answer
 * (typically "nothing new"). A GraphQL comment naming the current time window
 * makes the body change once per window: polls see new rows within a window,
 * while all viewers polling in the same window still share one cached response.
 */
export function withCacheWindow(request: GraphqlRequest, windowMs: number, now = Date.now()): GraphqlRequest {
  return {
    query: `# cache-window ${Math.floor(now / windowMs)}\n${request.query}`,
    variables: request.variables,
  }
}

/**
 * Build the global feed's cursor condition for the (blockNumber, transactionIndex,
 * logIndex) tuple. The full tuple is required because logIndex is tx-local per the
 * schema docstring — two txs in the same block can collide on logIndex and silently
 * skip rows on page boundaries. Returns a fragment to splice into a _and array, or
 * empty string. Profile feeds pass the same tuple to `profile_feed` instead, which
 * applies the comparison inside the indexed function.
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
 * Profile feed page, backed by the indexer's `profile_feed` Postgres function.
 *
 * The function resolves profile membership through indexed relations and returns
 * plain Feed rows already ordered by (blockNumber, transactionIndex, logIndex)
 * descending. All five function args are nullable; omitting the cursor returns
 * the newest page. `p_limit` is clamped server-side.
 */
export function buildProfileFeedRequest(
  profileId: string,
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
): GraphqlRequest {
  const query = `
    query ProfileFeed(
      $profileId: String!
      $limit: Int!
      $beforeBlock: Int
      $beforeTransactionIndex: Int
      $beforeLogIndex: Int
    ) {
      profile_feed(
        args: {
          p_profile: $profileId
          p_limit: $limit
          p_before_block: $beforeBlock
          p_before_tx: $beforeTransactionIndex
          p_before_log: $beforeLogIndex
        }
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  return {
    query,
    variables: {
      profileId: profileId.toLowerCase(),
      limit,
      // Null cursor args mean "start at the newest row". The tx/log components only
      // carry meaning alongside a block, so they stay null on the first page and
      // default to 0 afterwards — matching buildCursorCondition's global-feed tuple.
      beforeBlock: beforeBlock ?? null,
      beforeTransactionIndex: beforeBlock == null ? null : beforeTransactionIndex ?? 0,
      beforeLogIndex: beforeBlock == null ? null : beforeLogIndex ?? 0,
    },
  }
}

/** Global feed page (all activity, no profile filter). */
export function buildGlobalFeedRequest(
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
): GraphqlRequest {
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
  return { query, variables: {} }
}

/**
 * Global rows strictly newer than `after`, newest first — the cheap live-poll
 * query. The `_gte` block range is what keeps it cheap: it gives Postgres a
 * bounded scan over the blockNumber index, whereas the "newer than (block, tx,
 * log)" `_or` alone would let it walk the whole index whenever fewer than
 * `limit` rows match. The `_or` then drops the rows of `after`'s block that are
 * already known, so a poll without news returns nothing.
 */
export function buildGlobalFeedAfterRequest(
  limit: number,
  afterBlock: number,
  afterTransactionIndex = 0,
  afterLogIndex = 0,
): GraphqlRequest {
  for (const value of [afterBlock, afterTransactionIndex, afterLogIndex]) {
    if (!Number.isSafeInteger(value)) throw new Error(`Invalid feed cursor value: ${value}`)
  }
  const query = `
    query GlobalFeedAfter {
      Feed(
        limit: ${limit},
        where: { _and: [
          { blockNumber: { _gte: ${afterBlock} } },
          { _or: [
            { blockNumber: { _gt: ${afterBlock} } },
            { blockNumber: { _eq: ${afterBlock} }, transactionIndex: { _gt: ${afterTransactionIndex} } },
            { blockNumber: { _eq: ${afterBlock} }, transactionIndex: { _eq: ${afterTransactionIndex} }, logIndex: { _gt: ${afterLogIndex} } }
          ] }
        ] },
        order_by: [{ blockNumber: desc }, { transactionIndex: desc }, { logIndex: desc }]
      ) {
        ${FEED_FIELDS}
      }
    }
  `
  return { query, variables: {} }
}
