import makeBlockie from 'ethereum-blockies-base64'
import type { AddressIdentity } from './types'

export { makeBlockie }

/**
 * Detect if an address is an EOA (not a Universal Profile).
 * EOAs have no profileImages and their __gqltype is not "Profile".
 */
export function isEOA(identity: AddressIdentity | undefined | null): boolean {
  if (!identity) return true
  if (identity.__gqltype === 'Profile') return false
  if (identity.profileImages?.length) return false
  return true
}
