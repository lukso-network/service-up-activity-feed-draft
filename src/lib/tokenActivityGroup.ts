import type { Transaction } from './types'
import { HYPERLANE_BRIDGE_CONTRACT, LIKES_CONTRACT } from './events'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Token activity types that render through TransferCard and can be grouped when repeated */
export const GROUPABLE_TOKEN_TYPES = new Set([
  'token_mint',
  'nft_mint',
  'token_transfer',
  'nft_transfer',
  'token_burn',
  'nft_burn',
])

/** Max gap between two adjacent repeated actions to still count as one burst */
export const TOKEN_GROUP_MAX_GAP_SECONDS = 10 * 60

export interface TokenActivitySignature {
  type: string
  /** Minter for mints, sender for transfers and burns */
  actor: string
  /** Receiver for transfers, zero/dead address for burns, minter for mints */
  counterparty: string
  contract: string
}

function getArg(tx: Transaction, name: string): unknown {
  return tx.args?.find(a => a.name === name)?.value
}

function getTransferLog(tx: Transaction, mintOnly: boolean): any {
  return tx.logs?.find((l: any) =>
    l.eventName === 'Transfer' &&
    (!mintOnly || l.args?.some((a: any) => a.name === 'from' && a.value === ZERO_ADDRESS))
  )
}

function getLogArg(log: any, name: string): string {
  const value = log?.args?.find((a: any) => a.name === name)?.value
  return typeof value === 'string' ? value : ''
}

/**
 * Identity of a repeatable token action — mirrors how TransferCard picks the
 * minter/sender, receiver and token contract. Returns null when the tx should
 * never be grouped (batch transfers, likes, bridge transfers, missing data).
 */
export function getTokenActivitySignature(tx: Transaction, type: string): TokenActivitySignature | null {
  if (!GROUPABLE_TOKEN_TYPES.has(type)) return null

  const toArg = getArg(tx, 'to')
  const fromArg = getArg(tx, 'from')
  if (Array.isArray(toArg) || Array.isArray(fromArg)) return null

  const isMint = type === 'token_mint' || type === 'nft_mint'
  const transferLog = getTransferLog(tx, isMint)
  const contract = (transferLog?.address || tx.to || '').toLowerCase()
  if (!contract || contract === LIKES_CONTRACT) return null

  const to = (getLogArg(transferLog, 'to') || (typeof toArg === 'string' ? toArg : '')).toLowerCase()

  if (isMint) {
    const executed = tx.logs?.find((l: any) => l.eventName === 'Executed')
    const minter = (to || executed?.address || tx.from || '').toLowerCase()
    if (!minter) return null
    return { type, actor: minter, counterparty: minter, contract }
  }

  const sender = ((typeof fromArg === 'string' ? fromArg : '') || tx.from || '').toLowerCase()
  if (!sender || !to || to === HYPERLANE_BRIDGE_CONTRACT) return null
  return { type, actor: sender, counterparty: to, contract }
}

export function isSameTokenActivity(a: TokenActivitySignature, b: TokenActivitySignature): boolean {
  return a.type === b.type &&
    a.actor === b.actor &&
    a.counterparty === b.counterparty &&
    a.contract === b.contract
}

/** Raw LSP7 amount of a single mint/transfer/burn, or null when unknown */
export function getRawTokenAmount(tx: Transaction, type: string): bigint | null {
  const isMint = type === 'token_mint' || type === 'nft_mint'
  const logAmount = getTransferLog(tx, isMint)?.args?.find((a: any) => a.name === 'amount')?.value
  const value = logAmount ?? getArg(tx, 'amount')
  if (value == null || value === '') return null
  try {
    return BigInt(String(value).replace(/n$/, ''))
  } catch {
    return null
  }
}
