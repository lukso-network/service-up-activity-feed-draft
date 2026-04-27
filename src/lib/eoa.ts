import makeBlockie from 'ethereum-blockies-base64'
import type { AddressIdentity } from './types'

export { makeBlockie }

/**
 * Detect if an address is an EOA (not a Universal Profile / contract asset).
 * Resolved Profile and Asset identities are smart-contract entities and should render
 * with their profile/icon image plus an identicon badge instead of a standalone blockie.
 */
export function isEOA(identity: AddressIdentity | undefined | null): boolean {
  if (!identity) return true
  if (identity.__gqltype === 'Profile' || identity.__gqltype === 'Asset') return false
  if (identity.profileImages?.length) return false
  if (identity.icons?.length || identity.images?.length) return false
  if (identity.isLSP7 || identity.isCollection) return false
  if (identity.lsp4TokenName || identity.lsp4TokenSymbol) return false
  if (identity.standard?.includes('LSP7') || identity.standard?.includes('LSP8')) return false
  return true
}

/**
 * Detect if an address identity belongs to a bot / AI agent.
 * Checks the tags array for "AI-Agent" (case-insensitive).
 */
export function isBot(identity: AddressIdentity | undefined | null): boolean {
  if (!identity?.tags?.length) return false
  const normalized = identity.tags.map(tag => tag.toLowerCase().replace(/[\s\-_]+/g, ''))
  return normalized.includes('aiagent')
}
