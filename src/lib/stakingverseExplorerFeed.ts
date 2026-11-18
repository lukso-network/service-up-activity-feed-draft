import type { FeedEntry } from './feedTypes'

const EXPLORER_API_BASE = 'https://explorer.execution.mainnet.lukso.network/api/v2'
const STAKINGVERSE_VAULT = '0x9f49a95b0c3c9e2a6c77a16c177928294c0f6f04'
const DEPOSIT_SELECTOR = '0xf340fa01'
const MAX_EXPLORER_PAGES = 4

interface ExplorerAddressRef {
  hash?: string
}

interface ExplorerDecodedInput {
  method_id?: string
  parameters?: Array<{
    name?: string
    type?: string
    value?: unknown
  }>
}

interface ExplorerTransaction {
  hash?: string
  block_number?: number
  position?: number
  timestamp?: string
  result?: string
  status?: string
  value?: string
  method?: string | null
  raw_input?: string
  from?: ExplorerAddressRef
  to?: ExplorerAddressRef
  decoded_input?: ExplorerDecodedInput | null
}

interface ExplorerTransactionsResponse {
  items?: ExplorerTransaction[]
  next_page_params?: Record<string, string | number | boolean | null>
}

export async function fetchStakingverseDepositEntries(
  profileId: string | undefined,
  limit: number,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
  lowerBlock?: number,
  lowerTransactionIndex?: number,
  lowerLogIndex?: number,
  options: DepositFetchOptions = {},
): Promise<FeedEntry[] | null> {
  if (!profileId && beforeBlock == null && lowerBlock == null) return []

  const endpoint = profileId
    ? `${EXPLORER_API_BASE}/addresses/${profileId}/transactions`
    : `${EXPLORER_API_BASE}/addresses/${STAKINGVERSE_VAULT}/transactions?filter=to`

  try {
    const explorerTxs = await fetchExplorerTransactions(
      endpoint,
      options.reuseFetchedAfterMs ?? Number.POSITIVE_INFINITY,
      lowerBlock,
      lowerTransactionIndex,
      lowerLogIndex,
    )
    return explorerTxs
      .filter((tx) => isDirectStakingverseDeposit(tx, profileId))
      .filter((tx) => isBeforeCursor(tx, beforeBlock, beforeTransactionIndex, beforeLogIndex))
      .filter((tx) => isAtOrAfterCursor(tx, lowerBlock, lowerTransactionIndex, lowerLogIndex))
      .slice(0, limit)
      .map(explorerTxToFeedEntry)
  } catch (error) {
    // The feed works without the supplement; callers only learn it is missing.
    console.warn('[stakingverseExplorerFeed] fetch failed:', error)
    return null
  }
}

export interface DepositFetchOptions {
  /**
   * Reuse a recent explorer response only if it was requested at or after this
   * time (ms). A range that ended in the past can be served from a response
   * requested after it ended; an open-ended range ("up to now") passes
   * Infinity and always gets a fresh first page. Default: Infinity.
   */
  reuseFetchedAfterMs?: number
}

// Every feed page asks for the deposits in its own block range, but the explorer
// lists newest first, so each call starts by downloading the same newest page —
// about 1.7 MB for the vault's list. Reusing recent responses (where the range
// allows it, see DepositFetchOptions) makes loading several pages one download.
const EXPLORER_RESPONSE_TTL_MS = 30_000
const explorerResponses = new Map<string, { at: number; data: Promise<ExplorerTransactionsResponse> }>()

function fetchExplorerPage(url: string, reuseFetchedAfterMs: number): Promise<ExplorerTransactionsResponse> {
  const now = Date.now()
  for (const [key, cached] of explorerResponses) {
    if (now - cached.at > EXPLORER_RESPONSE_TTL_MS) explorerResponses.delete(key)
  }
  const cached = explorerResponses.get(url)
  if (cached && cached.at >= reuseFetchedAfterMs) return cached.data

  const data = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`Explorer API error: ${res.status} ${res.statusText}`)
    return (await res.json()) as ExplorerTransactionsResponse
  })
  const entry = { at: now, data }
  explorerResponses.set(url, entry)
  // Failures are not reused.
  data.catch(() => {
    if (explorerResponses.get(url) === entry) explorerResponses.delete(url)
  })
  return data
}

async function fetchExplorerTransactions(
  endpoint: string,
  reuseFetchedAfterMs: number,
  lowerBlock?: number,
  lowerTransactionIndex?: number,
  lowerLogIndex?: number,
): Promise<ExplorerTransaction[]> {
  const transactions: ExplorerTransaction[] = []
  let url = new URL(endpoint)

  for (let page = 0; page < MAX_EXPLORER_PAGES; page++) {
    // Only the newest page gains new rows; older pages (addressed by their
    // page params) can always be reused while they are fresh.
    const data = await fetchExplorerPage(url.toString(), page === 0 ? reuseFetchedAfterMs : 0)
    const items = data.items ?? []
    transactions.push(...items)

    const lastItem = items[items.length - 1]
    if (!data.next_page_params || !lastItem) break
    if (lowerBlock != null && isBeforeCursor(lastItem, lowerBlock, lowerTransactionIndex, lowerLogIndex)) break

    url = new URL(endpoint)
    for (const [key, value] of Object.entries(data.next_page_params)) {
      if (value != null) url.searchParams.set(key, String(value))
    }
  }

  return transactions
}

function isDirectStakingverseDeposit(tx: ExplorerTransaction, profileId?: string): boolean {
  if (tx.result !== 'success' && tx.status !== 'ok') return false
  if (normalizeAddress(tx.to?.hash) !== STAKINGVERSE_VAULT) return false
  if (profileId && normalizeAddress(tx.from?.hash) !== normalizeAddress(profileId)) return false

  const value = String(tx.value ?? '0')
  if (!isPositiveBigInt(value)) return false

  const selector = normalizeSelector(tx.decoded_input?.method_id || tx.raw_input)
  return tx.method === 'deposit' || selector === DEPOSIT_SELECTOR || selector === ''
}

function explorerTxToFeedEntry(tx: ExplorerTransaction): FeedEntry {
  const from = tx.from?.hash ?? ''
  const to = tx.to?.hash ?? STAKINGVERSE_VAULT
  const timestamp = tx.timestamp ? Math.floor(Date.parse(tx.timestamp) / 1000) : 0
  const selector = normalizeSelector(tx.decoded_input?.method_id || tx.raw_input) || DEPOSIT_SELECTOR

  return {
    id: `stakingverse:${tx.hash}`,
    blockNumber: tx.block_number ?? 0,
    transactionHash: tx.hash ?? '',
    transactionIndex: tx.position ?? 0,
    logIndex: -1,
    address: to,
    eventType: 'action_executed',
    decoded: {
      profile: from,
      target: to,
      selector,
      value: tx.value ?? '0',
      transaction: {
        functionName: 'deposit',
        standard: 'StakingverseVault',
        args: (tx.decoded_input?.parameters ?? []).map((param) => ({
          name: String(param.name ?? ''),
          internalType: String(param.type ?? ''),
          type: String(param.type ?? ''),
          value: param.value,
        })),
      },
    },
    timestamp,
    profileArgs: [],
    assetArgs: [],
  }
}

function isBeforeCursor(
  tx: ExplorerTransaction,
  beforeBlock?: number,
  beforeTransactionIndex?: number,
  beforeLogIndex?: number,
): boolean {
  if (beforeBlock == null) return true

  const block = tx.block_number ?? 0
  const txIndex = tx.position ?? 0
  const logIndex = -1
  const cursorTxIndex = beforeTransactionIndex ?? 0
  const cursorLogIndex = beforeLogIndex ?? 0

  return block < beforeBlock
    || (block === beforeBlock && txIndex < cursorTxIndex)
    || (block === beforeBlock && txIndex === cursorTxIndex && logIndex < cursorLogIndex)
}

function isAtOrAfterCursor(
  tx: ExplorerTransaction,
  lowerBlock?: number,
  lowerTransactionIndex?: number,
  lowerLogIndex?: number,
): boolean {
  if (lowerBlock == null) return true

  const block = tx.block_number ?? 0
  const txIndex = tx.position ?? 0
  const logIndex = -1
  const cursorTxIndex = lowerTransactionIndex ?? 0
  const cursorLogIndex = lowerLogIndex ?? 0

  return block > lowerBlock
    || (block === lowerBlock && txIndex > cursorTxIndex)
    || (block === lowerBlock && txIndex === cursorTxIndex && logIndex >= cursorLogIndex)
}

function normalizeAddress(address?: string): string {
  return address?.toLowerCase() ?? ''
}

function normalizeSelector(value?: string): string {
  if (!value) return ''
  const normalized = value.toLowerCase()
  if (normalized === '0x') return ''
  if (!normalized.startsWith('0x') || normalized.length < 10) return ''
  return normalized.slice(0, 10)
}

function isPositiveBigInt(value: string): boolean {
  try {
    return BigInt(value) > 0n
  } catch {
    return false
  }
}
