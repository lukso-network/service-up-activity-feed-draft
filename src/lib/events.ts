/**
 * Event signature constants (topic0 = keccak256 of event signature)
 *
 * Used to identify events in raw logs by their topic0,
 * regardless of whether the API decoded them or not.
 *
 * Precomputed with: ethers.keccak256(ethers.toUtf8Bytes(sig))
 */

// ─── LSP26 FollowerSystem ───
// Follow(address follower, address followed) — non-indexed, both in data
export const FOLLOW_EVENT = '0xbccc71dc7842b86291138666aa18e133ee6d41aa71e6d7c650debad1a0576635'
// Unfollow(address unfollower, address unfollowed) — non-indexed, both in data
export const UNFOLLOW_EVENT = '0x083700fd0063810cf62325646027ca3060e0e2e06ffc41a3a5bba81bdaee1e02'

// ─── LSP7 Digital Asset ───
// Transfer(address operator, address from, address to, uint256 amount, bool force, bytes data)
export const LSP7_TRANSFER_EVENT = '0x3997e418d2cef0b3b0e907b1e39605c3f7d32dbd061e82ea5b4a770d46a160a6'

// ─── LSP8 Identifiable Digital Asset ───
// Transfer(address operator, address from, address to, bytes32 tokenId, bool force, bytes data)
export const LSP8_TRANSFER_EVENT = '0xb333c813a7426a7a11e2b190cad52c44119421594b47f6f32ace6d8c7571593'

// ─── Universal Profile (LSP0/ERC725X) ───
// Executed(uint256 operationType, address target, uint256 value, bytes4 selector)
export const EXECUTED_EVENT = '0x4810874456b8e6487bd861375cf6abd8e1c8bb5858c8ce36a86a04dabfac199e'

// PermissionsVerified(address signer, uint256 value, bytes4 selector)
export const PERMISSIONS_VERIFIED_EVENT = '0xc0a62328f6bf5e3172bb1fcb2019f54b2c523b6a48e3513a2298fbf0150b781e'

// DataChanged(bytes32 dataKey, bytes dataValue)
export const DATA_CHANGED_EVENT = '0xece574603820d07bc9b91f2a932baadf4628aabcb8afba49776529c14a6104b2'

// UniversalReceiver(address from, uint256 value, bytes32 typeId, bytes receivedData, bytes returnedValue)
export const UNIVERSAL_RECEIVER_EVENT = '0x9c3ba68eb5742b8e3961aea0afc7371a71bf433c8a67a831803b64c064a178c2'

// ─── LSP26 UniversalReceiver typeIds ───
// Sent to the followed profile's UP when someone follows them
export const LSP26_FOLLOW_TYPEID = '0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a'

// ─── Contract addresses ───
export const LSP26_ADDRESS = '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA'
export const LIKES_CONTRACT = '0x403bfd53617555295347e0f7725cfda480ab801e'
export const FM_COLLECTION = '0xef54710b5a78b4926104a65594539521eb440d37'

/**
 * Find a log by event signature (topic0)
 */
export function findLogByEvent(logs: any[] | undefined, eventSig: string): any | undefined {
  if (!logs?.length) return undefined
  return logs.find((l: any) => l.topics?.[0] === eventSig)
}

/**
 * Find all logs matching an event signature
 */
export function findAllLogsByEvent(logs: any[] | undefined, eventSig: string): any[] {
  if (!logs?.length) return []
  return logs.filter((l: any) => l.topics?.[0] === eventSig)
}

/**
 * Decode non-indexed address pair from log data (e.g., Follow/Unfollow events)
 * Data format: 0x + 32-byte padded address1 + 32-byte padded address2
 * Returns [address1, address2] or null
 */
export function decodeAddressPairFromData(data: string | undefined): [string, string] | null {
  if (!data || data.length < 130) return null // 0x + 64 + 64
  try {
    const addr1 = '0x' + data.slice(26, 66)
    const addr2 = '0x' + data.slice(90, 130)
    return [addr1, addr2]
  } catch {
    return null
  }
}
