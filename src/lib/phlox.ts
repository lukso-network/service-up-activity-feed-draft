import type { FeedEntry } from './feedTypes'

// Phlox DEX contracts on LUKSO mainnet (chainId 42). All lowercase for direct
// comparison against feed payloads.
export const PHLOX = {
  SWAP_ROUTER:      '0xb118414f5d12e284b8c7bc31aed5f7375cb81c20',
  UNIVERSAL_ROUTER: '0x2c11204d061f0eb8d2646a6351d276b361f65a24',
  FEE_SPLITTER:     '0x06f06db4df2405fb0af2e71bf06952e62b153181',
  POSITION_MANAGER: '0xafd2e797cf0d78e760fa456dd990f412938edd6e',
  FACTORY:          '0xfce4c544f07e2ca758a179788fe56e6a2941e681',
  QUOTER:           '0xbbb650e11fb62b9379e244edec748134340fa0bb',
  // Wrapped LYX deployed by Phlox (LSP7). Treat as native LYX in swap UI.
  WLYX:             '0x2db41674f2b882889e5e1bd09a3f3613952bc472',
} as const

export const PHLOX_ROUTERS: ReadonlySet<string> = new Set([
  PHLOX.SWAP_ROUTER,
  PHLOX.UNIVERSAL_ROUTER,
])

// Function selectors we care about.
const SELECTOR_AUTHORIZE_OPERATOR = '0xb49506fd' // LSP7.authorizeOperator(address,uint256,bytes)
const SELECTOR_UR_EXECUTE_DEADLINE = '0x3593564c' // UniversalRouter.execute(bytes,bytes[],uint256)
const SELECTOR_UR_EXECUTE          = '0x24856bc3' // UniversalRouter.execute(bytes,bytes[])

// Sentinel asset id used to represent native LYX in the swap descriptor.
export const PHLOX_LYX_ASSET = '__phlox_lyx__'

export interface PhloxSwapToken {
  /** Token contract address, or PHLOX_LYX_ASSET for native LYX. */
  address: string
  /** Display symbol (e.g. "LYX", "USDC"). */
  symbol: string
  /** Display name (e.g. "Bridged USDC (Hyperlane)"). */
  name?: string
  /** Token decimals (defaults to 18 for LYX/unknown). */
  decimals: number
  /** Pre-formatted amount in major units (e.g. "5.581"). */
  formattedAmount: string
  /** Raw amount in token's smallest unit (decimal string). */
  rawAmount: string
}

export interface PhloxSwapInfo {
  /** Lowercase address of the swap actor (the Universal Profile that swapped). */
  actor: string
  /** Lowercase address of the final recipient — typically the actor. */
  recipient: string
  input: PhloxSwapToken
  output: PhloxSwapToken
  /** Which Phlox router executed the swap. */
  router: 'swap' | 'universal' | 'unknown'
  /** True when the input or output token could not be reconstructed. */
  partial: boolean
}

export interface PhloxConsolidationResult {
  entries: FeedEntry[]
  /** Map from canonical entry id → swap descriptor. */
  swaps: Map<string, PhloxSwapInfo>
}

type DecodedRecord = Record<string, unknown>

function asRecord(value: unknown): DecodedRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as DecodedRecord
}

function lowerAddress(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function parseBigInt(value: unknown): bigint {
  if (value == null) return 0n
  if (typeof value === 'bigint') return value
  try {
    return BigInt(String(value).replace(/n$/, ''))
  } catch {
    return 0n
  }
}

/**
 * Returns the inner sub-call's decoded args for an action_executed entry.
 * The Envio indexer sometimes nests subcalls inside `transaction.children`
 * (when the UP used executeBatch) and sometimes places them directly on
 * `transaction` (when the UP used a single execute). We normalize both.
 */
function getInnerArgs(decoded: DecodedRecord): Array<DecodedRecord> {
  const tx = asRecord(decoded.transaction)
  if (!tx) return []
  const target = lowerAddress(decoded.target)
  const selector = lowerAddress(decoded.selector)

  // Single execute: tx is the inner subcall.
  const txFn = String(tx.functionName ?? '').toLowerCase()
  if (txFn !== 'executebatch' && Array.isArray(tx.args)) {
    return (tx.args as unknown[]).map(asRecord).filter((x): x is DecodedRecord => !!x)
  }

  // executeBatch: find child whose to+sig match.
  if (Array.isArray(tx.children)) {
    for (const raw of tx.children) {
      const child = asRecord(raw)
      if (!child) continue
      const childTo = lowerAddress(child.to)
      const childSig = lowerAddress(child.sig)
      if (childTo === target && childSig === selector && Array.isArray(child.args)) {
        return (child.args as unknown[]).map(asRecord).filter((x): x is DecodedRecord => !!x)
      }
    }
  }
  return []
}

function findArg(args: Array<DecodedRecord>, name: string): unknown {
  return args.find((a) => a.name === name)?.value
}

/**
 * Returns true if this action_executed represents a Phlox swap. Three patterns:
 *  1. Direct router call: target ∈ {SwapRouter, UniversalRouter}
 *  2. LSP7.authorizeOperator with operator = a Phlox router
 *  3. LSP7.authorizeOperator with operatorNotificationData prefixed with a UR
 *     execute selector (the LSP1-hook pattern used when the UP authorizes WLYX
 *     and the WLYX hook calls UniversalRouter.execute).
 */
export function isPhloxSwapAction(entry: FeedEntry): boolean {
  if (entry.eventType !== 'action_executed') return false
  const decoded = asRecord(entry.decoded)
  if (!decoded) return false

  const target = lowerAddress(decoded.target)
  if (PHLOX_ROUTERS.has(target)) return true

  const selector = lowerAddress(decoded.selector)
  if (selector !== SELECTOR_AUTHORIZE_OPERATOR) return false

  const args = getInnerArgs(decoded)
  const operator = lowerAddress(findArg(args, 'operator'))
  if (PHLOX_ROUTERS.has(operator)) return true

  const notif = findArg(args, 'operatorNotificationData')
  if (typeof notif === 'string') {
    const lower = notif.toLowerCase()
    if (lower.startsWith(SELECTOR_UR_EXECUTE_DEADLINE) || lower.startsWith(SELECTOR_UR_EXECUTE)) {
      return true
    }
  }
  return false
}

function routerKind(entry: FeedEntry): 'swap' | 'universal' | 'unknown' {
  const decoded = asRecord(entry.decoded)
  if (!decoded) return 'unknown'
  const target = lowerAddress(decoded.target)
  if (target === PHLOX.SWAP_ROUTER) return 'swap'
  if (target === PHLOX.UNIVERSAL_ROUTER) return 'universal'
  // LSP1-hook path: check operator / operatorNotificationData.
  const args = getInnerArgs(decoded)
  const operator = lowerAddress(findArg(args, 'operator'))
  if (operator === PHLOX.SWAP_ROUTER) return 'swap'
  if (operator === PHLOX.UNIVERSAL_ROUTER) return 'universal'
  const notif = findArg(args, 'operatorNotificationData')
  if (typeof notif === 'string' && notif.toLowerCase().startsWith(SELECTOR_UR_EXECUTE_DEADLINE)) {
    return 'universal'
  }
  if (typeof notif === 'string' && notif.toLowerCase().startsWith(SELECTOR_UR_EXECUTE)) {
    return 'universal'
  }
  return 'unknown'
}

interface AssetMeta {
  symbol: string
  name?: string
  decimals: number
  formatted?: string
}

function tokenMetaFromTransfer(entry: FeedEntry): AssetMeta {
  const d = asRecord(entry.decoded) ?? {}
  return {
    symbol: typeof d.tokenSymbol === 'string' ? d.tokenSymbol : '',
    name: typeof d.tokenName === 'string' ? d.tokenName : undefined,
    decimals: typeof d.decimals === 'number' ? d.decimals : 18,
  }
}

function formatRawAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return '0'
  if (decimals <= 0) return raw.toString()
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const divisor = 10n ** BigInt(decimals)
  const whole = abs / divisor
  const frac = abs % divisor
  const wholeStr = whole.toString()
  if (frac === 0n) return negative ? `-${wholeStr}` : wholeStr
  // 4 fractional digits matches the rest of the app (formatLYX, TransferCard).
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4)
  const result = fracStr ? `${wholeStr}.${fracStr}` : wholeStr
  return negative ? `-${result}` : result
}

interface TokenAggregate {
  meta: AssetMeta
  // address → net amount (positive = received, negative = sent)
  netByAddress: Map<string, bigint>
}

function aggregateTokenFlows(
  txEntries: readonly FeedEntry[],
  actor: string,
): { tokens: Map<string, TokenAggregate>; lyxNet: bigint; lyxMeta: AssetMeta } {
  const tokens = new Map<string, TokenAggregate>()
  let lyxNet = 0n

  for (const entry of txEntries) {
    if (entry.eventType === 'lsp7_transfer') {
      const decoded = asRecord(entry.decoded)
      if (!decoded) continue
      const asset = lowerAddress(entry.address)
      const from = lowerAddress(decoded.from)
      const to = lowerAddress(decoded.to)
      const amount = parseBigInt(decoded.amount)
      if (!asset || amount === 0n) continue
      let agg = tokens.get(asset)
      if (!agg) {
        agg = { meta: tokenMetaFromTransfer(entry), netByAddress: new Map() }
        tokens.set(asset, agg)
      }
      // First seen formatted value: prefer the row touching the actor.
      const formatted = (decoded as DecodedRecord).formattedAmount
      if (typeof formatted === 'string' && (!agg.meta.formatted || from === actor || to === actor)) {
        agg.meta.formatted = formatted
      }
      if (from) agg.netByAddress.set(from, (agg.netByAddress.get(from) ?? 0n) - amount)
      if (to) agg.netByAddress.set(to, (agg.netByAddress.get(to) ?? 0n) + amount)
      continue
    }
    if (entry.eventType === 'lyx_sent' || entry.eventType === 'lyx_received') {
      const decoded = asRecord(entry.decoded)
      if (!decoded) continue
      const from = lowerAddress(decoded.from)
      const to = lowerAddress(decoded.to)
      const amount = parseBigInt(decoded.amount)
      if (from === actor) lyxNet -= amount
      if (to === actor) lyxNet += amount
    }
  }

  return { tokens, lyxNet, lyxMeta: { symbol: 'LYX', decimals: 18 } }
}

/**
 * Compute net change for `actor` across all assets in the tx, then identify the
 * input asset (largest net decrease) and output asset (largest net increase).
 * Returns null if neither side could be determined.
 */
function computeSwapInfo(
  canonical: FeedEntry,
  txEntries: readonly FeedEntry[],
): PhloxSwapInfo | null {
  const decoded = asRecord(canonical.decoded)
  if (!decoded) return null
  const actor = lowerAddress(decoded.profile)
  if (!actor) return null

  const router = routerKind(canonical)
  const { tokens, lyxNet } = aggregateTokenFlows(txEntries, actor)

  // Include the action_executed msg.value as an LYX outflow (SR auto-wraps).
  let actorLyx = lyxNet
  const actionValue = parseBigInt(decoded.value)
  if (actionValue > 0n) actorLyx -= actionValue

  type Candidate = { asset: string; net: bigint; meta: AssetMeta; raw: bigint }
  const negatives: Candidate[] = []
  const positives: Candidate[] = []

  for (const [asset, agg] of tokens) {
    const net = agg.netByAddress.get(actor) ?? 0n
    if (net === 0n) continue
    const candidate: Candidate = {
      asset,
      net,
      meta: agg.meta,
      raw: net < 0n ? -net : net,
    }
    if (net < 0n) negatives.push(candidate)
    else positives.push(candidate)
  }

  if (actorLyx < 0n) {
    negatives.push({
      asset: PHLOX_LYX_ASSET,
      net: actorLyx,
      meta: { symbol: 'LYX', decimals: 18 },
      raw: -actorLyx,
    })
  } else if (actorLyx > 0n) {
    positives.push({
      asset: PHLOX_LYX_ASSET,
      net: actorLyx,
      meta: { symbol: 'LYX', decimals: 18 },
      raw: actorLyx,
    })
  }

  // Pick the biggest decrease and biggest increase; if neither exists, we cannot
  // render a useful card.
  const sortByRawDesc = (a: Candidate, b: Candidate) => (a.raw > b.raw ? -1 : a.raw < b.raw ? 1 : 0)
  negatives.sort(sortByRawDesc)
  positives.sort(sortByRawDesc)

  const inputCand = negatives[0]
  const outputCand = positives[0]
  if (!inputCand && !outputCand) return null

  // Recipient resolution: if the actor has no positive net for any asset but
  // some other non-router address has a positive net for a non-input token,
  // treat that address as the recipient.
  let recipient = actor
  let resolvedOutput = outputCand
  if (!resolvedOutput && inputCand) {
    for (const [asset, agg] of tokens) {
      if (asset === inputCand.asset) continue
      let bestAddr = ''
      let bestNet = 0n
      for (const [addr, net] of agg.netByAddress) {
        if (addr === actor) continue
        if (addr === PHLOX.FEE_SPLITTER) continue
        if (PHLOX_ROUTERS.has(addr)) continue
        if (net > bestNet) {
          bestNet = net
          bestAddr = addr
        }
      }
      if (bestNet > 0n) {
        recipient = bestAddr
        resolvedOutput = {
          asset,
          net: bestNet,
          meta: agg.meta,
          raw: bestNet,
        }
        break
      }
    }
  }

  const input = inputCand ? candidateToToken(inputCand) : unknownToken()
  const output = resolvedOutput ? candidateToToken(resolvedOutput) : unknownToken()
  const partial = !inputCand || !resolvedOutput

  return {
    actor,
    recipient,
    input,
    output,
    router,
    partial,
  }
}

function candidateToToken(c: { asset: string; meta: AssetMeta; raw: bigint }): PhloxSwapToken {
  const isLyxLike = c.asset === PHLOX_LYX_ASSET || c.asset === PHLOX.WLYX
  const symbol = isLyxLike ? 'LYX' : (c.meta.symbol || '')
  const decimals = isLyxLike ? 18 : c.meta.decimals
  // Always format from the computed *net* — the feed-provided formattedAmount
  // is per-row and would understate aggregate flows (e.g. when fees are
  // rebated to the actor in a separate transfer).
  const formatted = formatRawAmount(c.raw, decimals)
  return {
    address: c.asset,
    symbol,
    name: c.meta.name,
    decimals,
    formattedAmount: formatted,
    rawAmount: c.raw.toString(),
  }
}

function unknownToken(): PhloxSwapToken {
  return {
    address: '',
    symbol: '',
    decimals: 18,
    formattedAmount: '',
    rawAmount: '0',
  }
}

/**
 * Scan feed entries, detect Phlox swaps grouped by transaction, and produce a
 * new entries list with:
 *  - swap-related transfer rows suppressed (input leg, output leg, fee rows)
 *  - secondary action_executed swap rows suppressed (e.g. token authorize when
 *    a router-target action also exists)
 *  - the canonical action_executed row annotated with `_phloxSwap` inside
 *    `decoded`, so feedAdapter can pick it up.
 *
 * The original entries array is not mutated.
 */
export function consolidatePhloxSwaps(entries: readonly FeedEntry[]): PhloxConsolidationResult {
  const byTx = new Map<string, FeedEntry[]>()
  for (const entry of entries) {
    const hash = entry.transactionHash
    if (!hash) continue
    let list = byTx.get(hash)
    if (!list) {
      list = []
      byTx.set(hash, list)
    }
    list.push(entry)
  }

  const suppressed = new Set<string>()
  const swaps = new Map<string, PhloxSwapInfo>()

  for (const [, txEntries] of byTx) {
    const phloxActions = txEntries.filter((e) => isPhloxSwapAction(e))
    if (phloxActions.length === 0) continue

    // Prefer the action whose target is a known router; otherwise take the
    // first Phlox-related action_executed (LSP1-hook pattern).
    const canonical =
      phloxActions.find((e) => {
        const target = lowerAddress(asRecord(e.decoded)?.target)
        return PHLOX_ROUTERS.has(target)
      }) ?? phloxActions[0]

    for (const e of phloxActions) {
      if (e !== canonical) suppressed.add(e.id)
    }

    const swap = computeSwapInfo(canonical, txEntries)
    if (!swap) {
      // Couldn't reconstruct — still suppress secondary swap actions but keep
      // transfer rows so the user sees something. The canonical action falls
      // through to the generic "Execute" classification.
      continue
    }

    swaps.set(canonical.id, swap)

    // Suppress all swap-leg transfer rows: any row touching the input or
    // output assets, plus any row involving the fee splitter or a router.
    const inputAsset = swap.input.address
    const outputAsset = swap.output.address
    for (const e of txEntries) {
      if (e === canonical || suppressed.has(e.id)) continue
      if (e.eventType !== 'lsp7_transfer' && e.eventType !== 'lyx_sent' && e.eventType !== 'lyx_received') {
        continue
      }
      const asset = lowerAddress(e.address)
      const d = asRecord(e.decoded)
      const from = lowerAddress(d?.from)
      const to = lowerAddress(d?.to)
      const involvesFee = from === PHLOX.FEE_SPLITTER || to === PHLOX.FEE_SPLITTER
      const involvesRouter = PHLOX_ROUTERS.has(from) || PHLOX_ROUTERS.has(to)
      const matchesInput = !!inputAsset && asset === inputAsset
      const matchesOutput = !!outputAsset && asset === outputAsset
      const lyxInput = inputAsset === PHLOX_LYX_ASSET && (e.eventType === 'lyx_sent' || e.eventType === 'lyx_received') && (from === swap.actor || to === swap.actor)
      const lyxOutput = outputAsset === PHLOX_LYX_ASSET && (e.eventType === 'lyx_sent' || e.eventType === 'lyx_received') && (from === swap.actor || to === swap.actor)
      if (matchesInput || matchesOutput || involvesFee || involvesRouter || lyxInput || lyxOutput) {
        suppressed.add(e.id)
      }
    }
  }

  const resultEntries: FeedEntry[] = []
  for (const entry of entries) {
    if (suppressed.has(entry.id)) continue
    const swap = swaps.get(entry.id)
    if (swap) {
      const decoded = asRecord(entry.decoded) ?? {}
      resultEntries.push({
        ...entry,
        decoded: { ...decoded, _phloxSwap: swap } as FeedEntry['decoded'],
      })
    } else {
      resultEntries.push(entry)
    }
  }

  return { entries: resultEntries, swaps }
}

/** Test/debug helper: read attached swap info from an entry's decoded payload. */
export function readPhloxSwap(decoded: unknown): PhloxSwapInfo | undefined {
  const rec = asRecord(decoded)
  if (!rec) return undefined
  const swap = rec._phloxSwap
  return swap && typeof swap === 'object' ? (swap as PhloxSwapInfo) : undefined
}
