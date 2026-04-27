import type { FeedEntry } from './feedTypes'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type TransferKind = 'lsp7' | 'lsp8'
type DecodedRecord = Record<string, unknown>

interface TransferKeyParts {
  kind: TransferKind
  transactionHash: string
  assetAddress: string
  from: string
  to: string
  value: string
}

/**
 * Removes wrapper feed rows only when their represented transfer(s) are also
 * present as canonical standalone lsp7/lsp8 transfer rows.
 */
export function dedupeFeedTransferWrappers(entries: readonly FeedEntry[]): FeedEntry[] {
  const canonicalCounts = new Map<string, number>()

  for (const entry of entries) {
    const key = getStandaloneTransferKey(entry)
    if (!key) continue
    canonicalCounts.set(key, (canonicalCounts.get(key) ?? 0) + 1)
  }

  return entries.filter((entry) => {
    const wrapperKeys = getWrapperTransferKeys(entry)
    if (!wrapperKeys) return true
    return !areAllKeysCovered(wrapperKeys, canonicalCounts)
  })
}

function areAllKeysCovered(keys: string[], canonicalCounts: ReadonlyMap<string, number>): boolean {
  const needed = new Map<string, number>()
  for (const key of keys) {
    needed.set(key, (needed.get(key) ?? 0) + 1)
  }

  for (const [key, count] of needed) {
    if ((canonicalCounts.get(key) ?? 0) < count) return false
  }

  return true
}

function getStandaloneTransferKey(entry: FeedEntry): string | null {
  if (entry.eventType !== 'lsp7_transfer' && entry.eventType !== 'lsp8_transfer') {
    return null
  }

  const decoded = asRecord(entry.decoded)
  if (!decoded) return null

  const transactionHash = normalizeHash(entry.transactionHash)
  const assetAddress = normalizeAddress(entry.address)
  const from = normalizeAddress(decoded.from)
  const to = normalizeAddress(decoded.to)
  if (!transactionHash || !assetAddress || !from || !to) return null

  if (entry.eventType === 'lsp7_transfer') {
    const amount = normalizeIntegerLike(decoded.amount)
    if (!amount) return null
    return makeTransferKey({
      kind: 'lsp7',
      transactionHash,
      assetAddress,
      from,
      to,
      value: amount,
    })
  }

  const tokenId = normalizeHexLike(decoded.tokenId)
  if (!tokenId) return null
  return makeTransferKey({
    kind: 'lsp8',
    transactionHash,
    assetAddress,
    from,
    to,
    value: tokenId,
  })
}

function getWrapperTransferKeys(entry: FeedEntry): string[] | null {
  if (entry.eventType !== 'action_executed') return null

  const decoded = asRecord(entry.decoded)
  const transaction = asRecord(decoded?.transaction)
  if (!decoded || !transaction) return null

  const kind = getTransferKind(transaction.standard)
  const functionName = String(transaction.functionName ?? '').toLowerCase()
  if (!kind || !isTransferFunction(functionName)) return null

  const transactionHash = normalizeHash(entry.transactionHash)
  const assetAddress = inferWrapperAssetAddress(entry, decoded, transaction)
  if (!transactionHash || !assetAddress) return null

  const args = Array.isArray(transaction.args)
    ? transaction.args.map(asRecord).filter((arg): arg is DecodedRecord => !!arg)
    : []

  if (functionName === 'transferbatch') {
    return getBatchTransferKeys(kind, transactionHash, assetAddress, decoded, args)
  }

  const key = getSingleTransferKey(kind, transactionHash, assetAddress, decoded, args, functionName)
  return key ? [key] : null
}

function getSingleTransferKey(
  kind: TransferKind,
  transactionHash: string,
  assetAddress: string,
  decoded: DecodedRecord,
  args: DecodedRecord[],
  functionName: string,
): string | null {
  const from = normalizeAddress(getArgValue(args, 'from'))
    || (functionName === 'mint' ? ZERO_ADDRESS : normalizeAddress(decoded.profile))
  const to = normalizeAddress(getArgValue(args, 'to'))
  const value = getTransferValue(kind, getTransferValueArg(args, kind))

  if (!from || !to || !value) return null
  return makeTransferKey({ kind, transactionHash, assetAddress, from, to, value })
}

function getBatchTransferKeys(
  kind: TransferKind,
  transactionHash: string,
  assetAddress: string,
  decoded: DecodedRecord,
  args: DecodedRecord[],
): string[] | null {
  const fromArg = getArgValue(args, 'from')
  const toArg = getArgValue(args, 'to')
  const valueArg = getTransferValueArg(args, kind)

  if (!Array.isArray(toArg) || !Array.isArray(valueArg)) return null
  if (toArg.length === 0 || toArg.length !== valueArg.length) return null
  if (Array.isArray(fromArg) && fromArg.length !== toArg.length) return null

  const keys: string[] = []
  for (let i = 0; i < toArg.length; i += 1) {
    const fromValue = Array.isArray(fromArg) ? fromArg[i] : fromArg
    const from = normalizeAddress(fromValue) || normalizeAddress(decoded.profile)
    const to = normalizeAddress(toArg[i])
    const value = getTransferValue(kind, valueArg[i])

    if (!from || !to || !value) return null
    keys.push(makeTransferKey({ kind, transactionHash, assetAddress, from, to, value }))
  }

  return keys
}

function getTransferKind(standard: unknown): TransferKind | null {
  const value = String(standard ?? '').toLowerCase()
  if (value.includes('lsp7') || (value.includes('digitalasset') && !value.includes('identifiable'))) {
    return 'lsp7'
  }
  if (value.includes('lsp8') || value.includes('identifiabledigitalasset')) {
    return 'lsp8'
  }
  return null
}

function isTransferFunction(functionName: string): boolean {
  return functionName === 'transfer' || functionName === 'mint' || functionName === 'transferbatch'
}

function inferWrapperAssetAddress(
  entry: FeedEntry,
  decoded: DecodedRecord,
  transaction: DecodedRecord,
): string | null {
  const target = normalizeAddress(decoded.target)
  if (target) return target

  const transactionTo = normalizeAddress(transaction.to)
  if (transactionTo) return transactionTo

  const assetArgAddresses = Array.from(new Set(
    (entry.assetArgs ?? [])
      .map(({ asset }) => normalizeAddress(asset.id))
      .filter((address): address is string => !!address),
  ))
  if (assetArgAddresses.length === 1) return assetArgAddresses[0]

  const entryAddress = normalizeAddress(entry.address)
  if (assetArgAddresses.length === 0) return entryAddress
  return entryAddress && assetArgAddresses.includes(entryAddress) ? entryAddress : null
}

function getArgValue(args: DecodedRecord[], name: string): unknown {
  return args.find((arg) => arg.name === name)?.value
}

function getTransferValueArg(args: DecodedRecord[], kind: TransferKind): unknown {
  if (kind === 'lsp7') return getArgValue(args, 'amount') ?? getArgValue(args, 'amounts')
  return getArgValue(args, 'tokenId') ?? getArgValue(args, 'tokenIds')
}

function getTransferValue(kind: TransferKind, value: unknown): string | null {
  return kind === 'lsp7' ? normalizeIntegerLike(value) : normalizeHexLike(value)
}

function makeTransferKey(parts: TransferKeyParts): string {
  return [
    parts.transactionHash,
    parts.kind,
    parts.assetAddress,
    parts.from,
    parts.to,
    parts.value,
  ].join('|')
}

function asRecord(value: unknown): DecodedRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as DecodedRecord
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null
  return trimmed.toLowerCase()
}

function normalizeHash(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return null
  return trimmed.toLowerCase()
}

function normalizeIntegerLike(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'bigint') return value.toString()

  const trimmed = String(value).trim().replace(/n$/, '')
  if (!trimmed) return null

  try {
    return BigInt(trimmed).toString()
  } catch {
    return null
  }
}

function normalizeHexLike(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'bigint') return value.toString()

  const trimmed = String(value).trim().replace(/n$/, '')
  if (!trimmed) return null
  if (/^0x[0-9a-fA-F]*$/.test(trimmed)) return trimmed.toLowerCase()

  try {
    return BigInt(trimmed).toString()
  } catch {
    return trimmed.toLowerCase()
  }
}
