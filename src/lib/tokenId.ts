/**
 * LSP8 Token ID Decoder
 *
 * LSP8 tokenIds are bytes32. The LSP8TokenIdFormat data key on the contract
 * specifies how to interpret them:
 *
 *   0 = NUMBER    — uint256 (most common: sequential IDs like #1, #2, ...)
 *   1 = STRING    — utf8 string, right-padded with zeros in bytes32
 *   2 = ADDRESS   — address, left-padded with 12 zero bytes in bytes32
 *   3 = UNIQUE_ID — unique bytes32 identifier (display shortened hash)
 *   4 = HASH      — keccak256 hash (display shortened hash)
 *
 * Reference: https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-8-IdentifiableDigitalAsset.md
 */

export enum LSP8TokenIdFormat {
  NUMBER = 0,
  STRING = 1,
  ADDRESS = 2,
  UNIQUE_ID = 3,
  HASH = 4,
}

/** ERC725Y data key for LSP8TokenIdFormat */
export const LSP8_TOKEN_ID_FORMAT_KEY = '0xf675e9361af1c1664c1868cfa3eb97672d6b1a513aa5b81dec34c9ee330e818d'

/**
 * Decode a raw bytes32 tokenId based on its format.
 *
 * @param rawTokenId - The bytes32 token ID (0x-prefixed, 66 chars)
 * @param format - The LSP8TokenIdFormat (0-4). Defaults to NUMBER (0) if unknown.
 * @returns Object with display string and metadata
 */
export function decodeTokenId(
  rawTokenId: string,
  format: LSP8TokenIdFormat | number = LSP8TokenIdFormat.NUMBER
): { display: string; type: string; raw: string } {
  if (!rawTokenId || rawTokenId === '0x') {
    return { display: '???', type: 'unknown', raw: rawTokenId || '' }
  }

  // Normalize: ensure 0x prefix and 66 chars
  const id = rawTokenId.toLowerCase().startsWith('0x') ? rawTokenId : `0x${rawTokenId}`

  switch (format) {
    case LSP8TokenIdFormat.NUMBER: {
      try {
        const num = BigInt(id)
        return { display: `#${num.toString()}`, type: 'number', raw: id }
      } catch {
        return { display: id.slice(0, 10) + '...', type: 'number', raw: id }
      }
    }

    case LSP8TokenIdFormat.STRING: {
      // bytes32 with utf8 string right-padded with zeros
      try {
        const hex = id.startsWith('0x') ? id.slice(2) : id
        // Remove trailing zeros (pairs of 00)
        const trimmed = hex.replace(/(00)+$/, '')
        if (!trimmed) return { display: '(empty)', type: 'string', raw: id }
        // Decode hex to utf8
        const bytes = new Uint8Array(trimmed.length / 2)
        for (let i = 0; i < trimmed.length; i += 2) {
          bytes[i / 2] = parseInt(trimmed.slice(i, i + 2), 16)
        }
        const decoded = new TextDecoder().decode(bytes)
        return { display: decoded, type: 'string', raw: id }
      } catch {
        return { display: id.slice(0, 10) + '...', type: 'string', raw: id }
      }
    }

    case LSP8TokenIdFormat.ADDRESS: {
      // Left-padded: 12 zero bytes (24 hex chars) + 20-byte address
      const hex = id.startsWith('0x') ? id.slice(2) : id
      if (hex.length >= 64) {
        const addr = '0x' + hex.slice(24, 64)
        // Checksum would be nice but not essential
        return {
          display: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
          type: 'address',
          raw: addr,
        }
      }
      return { display: id.slice(0, 10) + '...', type: 'address', raw: id }
    }

    case LSP8TokenIdFormat.UNIQUE_ID:
    case LSP8TokenIdFormat.HASH: {
      // Display as shortened hash
      return {
        display: `${id.slice(0, 10)}...${id.slice(-4)}`,
        type: format === LSP8TokenIdFormat.HASH ? 'hash' : 'unique_id',
        raw: id,
      }
    }

    default: {
      // Unknown format — try to auto-detect
      return autoDecodeTokenId(id)
    }
  }
}

/**
 * Auto-detect and decode a tokenId when the format is unknown.
 * Heuristic: check if it looks like a padded number, address, or string.
 */
export function autoDecodeTokenId(rawTokenId: string): {
  display: string
  type: string
  raw: string
} {
  const id = rawTokenId.toLowerCase().startsWith('0x') ? rawTokenId : `0x${rawTokenId}`
  const hex = id.startsWith('0x') ? id.slice(2) : id

  // Check if it's a small number (leading zeros, significant digits at the end)
  try {
    const num = BigInt(id)
    if (num <= 999999n) {
      return { display: `#${num.toString()}`, type: 'number', raw: id }
    }
  } catch { /* not a valid BigInt */ }

  // Check if it looks like a padded address (24 leading zero hex chars + 40 hex address)
  if (hex.startsWith('000000000000000000000000') && hex.length === 64) {
    const addr = '0x' + hex.slice(24)
    if (addr !== '0x0000000000000000000000000000000000000000') {
      return { display: `${addr.slice(0, 6)}...${addr.slice(-4)}`, type: 'address', raw: addr }
    }
  }

  // Check if it could be a utf8 string (no null bytes before trailing zeros)
  const trimmed = hex.replace(/(00)+$/, '')
  if (trimmed && trimmed.length < 64) {
    try {
      const bytes = new Uint8Array(trimmed.length / 2)
      for (let i = 0; i < trimmed.length; i += 2) {
        bytes[i / 2] = parseInt(trimmed.slice(i, i + 2), 16)
      }
      const decoded = new TextDecoder().decode(bytes)
      // Only accept if it looks like readable text (printable ASCII)
      if (/^[\x20-\x7E]+$/.test(decoded)) {
        return { display: decoded, type: 'string', raw: id }
      }
    } catch { /* not valid utf8 */ }
  }

  // Large number
  try {
    const num = BigInt(id)
    return { display: `#${num.toString()}`, type: 'number', raw: id }
  } catch {
    return { display: `${id.slice(0, 10)}...${id.slice(-4)}`, type: 'hash', raw: id }
  }
}
