import type { ActivityResponse, ResolveAddressesResponse, AddressIdentity } from './types'

const API_BASE = 'https://auth-simple.pages.dev'

function parseBigIntStrings(obj: unknown): unknown {
  if (typeof obj === 'string' && /^\d+n$/.test(obj)) {
    return obj.slice(0, -1)
  }
  if (Array.isArray(obj)) {
    return obj.map(parseBigIntStrings)
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = parseBigIntStrings(value)
    }
    return result
  }
  return obj
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  const text = await res.text()
  const parsed = JSON.parse(text)
  return parseBigIntStrings(parsed) as T
}

export async function fetchActivity(
  chainId: number,
  address: string,
  options?: { toBlock?: number; fromBlock?: number }
): Promise<ActivityResponse> {
  const body: Record<string, unknown> = { chainId, address }
  if (options?.toBlock) body.toBlock = options.toBlock
  if (options?.fromBlock) body.fromBlock = options.fromBlock
  return post<ActivityResponse>('/api/activity', body)
}

export async function resolveAddresses(
  chainId: number,
  addresses: string[]
): Promise<ResolveAddressesResponse> {
  return post<ResolveAddressesResponse>('/api/resolveAddresses', {
    chainId,
    addresses,
  })
}

const RPC_URL = 'https://rpc.mainnet.lukso.network'
const IPFS_GATEWAY = 'https://api.universalprofile.cloud/ipfs'
// LSP4Metadata key
const LSP4_METADATA_KEY = '9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e'
// getData(bytes32) selector
const GET_DATA_SELECTOR = '0x54f6127f'
// getDataForTokenId(bytes32,bytes32) selector
const GET_DATA_FOR_TOKEN_ID_SELECTOR = '0x16e023b3'
// Known LSP8 collection contracts (Forever Moments)
const LSP8_COLLECTIONS: Record<string, string> = {
  '0xef54710b5a78b4926104a65594539521eb440d37': 'Forever Moments',
}

/**
 * Fetch LSP4Metadata for a token from its LSP8 collection contract.
 * The tokenId is the address (type 2) padded to bytes32.
 */
async function fetchLSP8TokenMetadata(collectionAddress: string, tokenAddress: string): Promise<Partial<AddressIdentity> | null> {
  try {
    // Pad address to bytes32 (left-pad with zeros)
    const tokenId = tokenAddress.toLowerCase().replace('0x', '').padStart(64, '0')
    const callData = `${GET_DATA_FOR_TOKEN_ID_SELECTOR}${tokenId}${LSP4_METADATA_KEY}`

    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: collectionAddress, data: callData }, 'latest'],
        id: 1,
      }),
    })
    const json = await res.json()
    return parseMetadataResult(json.result, tokenAddress)
  } catch {
    return null
  }
}

/**
 * Fetch LSP4Metadata directly from on-chain for contracts that the indexer doesn't cover.
 * First tries LSP8 collection lookup, then falls back to direct getData.
 */
export async function fetchLSP4Metadata(address: string): Promise<Partial<AddressIdentity> | null> {
  // Try LSP8 collection lookup first (e.g. Forever Moments)
  for (const [collectionAddr, collectionName] of Object.entries(LSP8_COLLECTIONS)) {
    const result = await fetchLSP8TokenMetadata(collectionAddr, address)
    if (result) {
      // Tag with collection name if no name found
      if (!result.lsp4TokenName) result.lsp4TokenName = collectionName
      return result
    }
  }

  // Fallback: direct getData on the contract itself
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: address, data: `${GET_DATA_SELECTOR}${LSP4_METADATA_KEY}` }, 'latest'],
        id: 1,
      }),
    })
    const json = await res.json()
    return parseMetadataResult(json.result, address)
  } catch {
    return null
  }
}

/**
 * Parse an ABI-encoded VerifiableURI result into identity metadata.
 */
async function parseMetadataResult(result: string, address: string): Promise<Partial<AddressIdentity> | null> {
  if (!result || result.length <= 66) return null

  const data = hexToBytes(result.slice(2))
  const length = bytesToInt(data.slice(32, 64))
  if (length === 0) return null
  const payload = data.slice(64, 64 + length)

  // Parse JSONURL / VerifiableURI
  const payloadHex = bytesToHex(payload)
  let metadataUrl = ''
  if (payloadHex.startsWith('00006f357c6a')) {
    // VerifiableURI with keccak256: 2 bytes hashFunction + 2 bytes hash + 32 bytes hash value + url
    const urlBytes = payload.slice(2 + 2 + 32)
    metadataUrl = new TextDecoder().decode(urlBytes)
  } else {
    metadataUrl = new TextDecoder().decode(payload)
  }

  if (!metadataUrl) return null

  if (metadataUrl.startsWith('ipfs://')) {
    metadataUrl = `${IPFS_GATEWAY}/${metadataUrl.slice(7)}`
  }

  const metaRes = await fetch(metadataUrl)
  if (!metaRes.ok) return null
  const meta = await metaRes.json()
  const lsp4 = meta.LSP4Metadata || meta

  const identity: Partial<AddressIdentity> = {
    address: address.toLowerCase(),
  }

  if (lsp4.name) identity.lsp4TokenName = lsp4.name
  if (lsp4.description) identity.description = lsp4.description

  if (lsp4.images?.length) {
    identity.images = lsp4.images.flat().map((img: any) => ({
      src: img.url?.startsWith('ipfs://') ? `${IPFS_GATEWAY}/${img.url.slice(7)}` : img.url,
      width: img.width || 0,
      height: img.height || 0,
    }))
  }

  if (lsp4.icon?.length) {
    identity.icons = lsp4.icon.map((img: any) => ({
      src: img.url?.startsWith('ipfs://') ? `${IPFS_GATEWAY}/${img.url.slice(7)}` : img.url,
      width: img.width || 0,
      height: img.height || 0,
    }))
  }

  return identity
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToInt(bytes: Uint8Array): number {
  let result = 0
  for (const byte of bytes) {
    result = result * 256 + byte
  }
  return result
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
