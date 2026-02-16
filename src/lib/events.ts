/**
 * LUKSO LSP Event Signatures & UniversalReceiver TypeIDs
 *
 * Event signatures: topic0 = keccak256 of event signature string
 * TypeIDs: keccak256 of the type name string, used in UniversalReceiver events
 *
 * Reference: https://docs.lukso.tech/contracts/type-ids
 */

// ═══════════════════════════════════════════════════════════════════
// EVENT SIGNATURES (topic0)
// ═══════════════════════════════════════════════════════════════════

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
export const LSP8_TRANSFER_EVENT = '0xb333c813a7426a7a11e2b190cad52c44119421594b47f6f32ace6d8c7207b2bf'

// ─── Universal Profile (LSP0/ERC725X) ───
// Executed(uint256 operationType, address target, uint256 value, bytes4 selector)
export const EXECUTED_EVENT = '0x4810874456b8e6487bd861375cf6abd8e1c8bb5858c8ce36a86a04dabfac199e'
// PermissionsVerified(address signer, uint256 value, bytes4 selector)
export const PERMISSIONS_VERIFIED_EVENT = '0xc0a62328f6bf5e3172bb1fcb2019f54b2c523b6a48e3513a2298fbf0150b781e'
// DataChanged(bytes32 dataKey, bytes dataValue)
export const DATA_CHANGED_EVENT = '0xece574603820d07bc9b91f2a932baadf4628aabcb8afba49776529c14a6104b2'
// TokenIdDataChanged(bytes32 tokenId, bytes32 dataKey, bytes dataValue) — per-token metadata
export const TOKEN_ID_DATA_CHANGED_EVENT = '0xa6e4251f855f750545fe414f120db91c76b88def14d120969e5bb2d3f05debbb'
// UniversalReceiver(address from, uint256 value, bytes32 typeId, bytes receivedData, bytes returnedValue)
export const UNIVERSAL_RECEIVER_EVENT = '0x9c3ba68eb5742b8e3961aea0afc7371a71bf433c8a67a831803b64c064a178c2'

// ═══════════════════════════════════════════════════════════════════
// UNIVERSAL RECEIVER TYPE IDS (used in UniversalReceiver event typeId field)
// ═══════════════════════════════════════════════════════════════════

// ─── LSP0 — ERC725 Account ───
export const LSP0_VALUE_RECEIVED = '0x9c4705229491d365fb5434052e12a386d6771d976bea61070a8c694e8affea3d'
export const LSP0_OWNERSHIP_TRANSFER_STARTED = '0xe17117c9d2665d1dbeb479ed8058bbebde3c50ac50e2e65619f60006caac6926'
export const LSP0_OWNERSHIP_TRANSFERRED_SENDER = '0xa4e59c931d14f7c8a7a35027f92ee40b5f2886b9fdcdb78f30bc5ecce5a2f814'
export const LSP0_OWNERSHIP_TRANSFERRED_RECIPIENT = '0xceca317f109c43507871523e82dc2a3cc64dfa18f12da0b6db14f6e23f995538'

// ─── LSP7 — Digital Asset ───
export const LSP7_TOKENS_SENDER = '0x429ac7a06903dbc9c13dfcb3c9d11df8194581fa047c96d7a4171fc7402958ea'
export const LSP7_TOKENS_RECIPIENT = '0x20804611b3e2ea21c480dc465142210acf4a2485947541770ec1fb87dee4a55c'
export const LSP7_TOKENS_OPERATOR = '0x386072cc5a58e61263b434c722725f21031cd06e7c552cfaa06db5de8a320dbc'

// ─── LSP8 — Identifiable Digital Asset ───
export const LSP8_TOKENS_SENDER = '0xb23eae7e6d1564b295b4c3e3be402d9a2f0776c57bdf365903496f6fa481ab00'
export const LSP8_TOKENS_RECIPIENT = '0x0b084a55ebf70fd3c06fd755269dac2212c4d3f0f4d09079780bfa50c1b2984d'
export const LSP8_TOKENS_OPERATOR = '0x468cd1581d7bc001c3b685513d2b929b55437be34700410383d58f3aa1ea0abc'

// ─── LSP9 — Vault ───
export const LSP9_VALUE_RECEIVED = '0x468cd1581d7bc001c3b685513d2b929b55437be34700410383d58f3aa1ea0abc'
export const LSP9_OWNERSHIP_TRANSFER_STARTED = '0xaefd43f45fed1bcd8992f23c803b6f4ec45cf6b62b0d404d565f290a471e763f'
export const LSP9_OWNERSHIP_TRANSFERRED_SENDER = '0x0c622e58e6b7089ae35f1af1c86d997be92fcdd8c9509652022d41aa65169471'
export const LSP9_OWNERSHIP_TRANSFERRED_RECIPIENT = '0x79855c97dbc259ce395421d933d7bc0699b0f1561f988f09a9e8633fd542fe5c'

// ─── LSP14 — Ownable 2-Step ───
export const LSP14_OWNERSHIP_TRANSFER_STARTED = '0xee9a7c0924f740a2ca33d59b7f0c2929821ea9837ce043ce91c1823e9c4e52c0'
export const LSP14_OWNERSHIP_TRANSFERRED_SENDER = '0xa124442e1cc7b52d8e2ede2787d43527dc1f3ae0de87f50dd03e27a71834f74c'
export const LSP14_OWNERSHIP_TRANSFERRED_RECIPIENT = '0xe32c7debcb817925ba4883fdbfc52797187f28f73f860641dab1a68d9b32902c'

// ─── LSP26 — Follower System ───
export const LSP26_FOLLOW_NOTIFICATION = '0x71e02f9f05bcd5816ec4f3134aa2e5a916669537ec6c77fe66ea595fabc2d51a'
export const LSP26_UNFOLLOW_NOTIFICATION = '0x9d3c0b4012b69658977b099bdaa51eff0f0460f421fba96d15669506c00d1c4f'

// ═══════════════════════════════════════════════════════════════════
// CONTRACT ADDRESSES (LUKSO Mainnet)
// ═══════════════════════════════════════════════════════════════════

export const LSP26_ADDRESS = '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA'
export const LIKES_CONTRACT = '0x403bfd53617555295347e0f7725cfda480ab801e'
export const FM_COLLECTION = '0xef54710b5a78b4926104a65594539521eb440d37'

// Hyperlane Bridge — LSP7 collateral contract on LUKSO (wraps LYX for cross-chain bridging)
export const HYPERLANE_BRIDGE_CONTRACT = '0xc210b2cb65ed3484892167f5e05f7ab496ab0598'
export const HYPERLANE_BRIDGE_URL = 'https://nexus.hyperlane.xyz/?origin=lukso&token=LYX&destination=ethereum'

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

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

/**
 * Find a UniversalReceiver log by its typeId
 */
export function findURByTypeId(logs: any[] | undefined, typeId: string): any | undefined {
  const urLogs = findAllLogsByEvent(logs, UNIVERSAL_RECEIVER_EVENT)
  return urLogs.find((log: any) => {
    // Decoded: check args
    if (log.args) {
      const typeIdArg = log.args.find((a: any) => a.name === 'typeId')
      if (typeIdArg?.value === typeId) return true
    }
    // Raw: typeId is topic[3] (indexed param)
    if (log.topics?.[3] === typeId) return true
    return false
  })
}

/**
 * Extract address from UniversalReceiver receivedData
 * receivedData is typically a raw 20-byte address (0x-prefixed, 42 chars)
 */
export function getAddressFromURReceivedData(log: any): string | null {
  if (!log) return null
  // Decoded
  if (log.args) {
    const rd = log.args.find((a: any) => a.name === 'receivedData')
    if (rd?.value && typeof rd.value === 'string' && rd.value.length === 42) {
      return rd.value
    }
  }
  return null
}
