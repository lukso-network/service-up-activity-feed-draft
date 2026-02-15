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
const LSP4_METADATA_KEY = '9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e'

/**
 * Fetch LSP4 name from on-chain metadata via RPC.
 * Uses getData(bytes32) to read LSP4Metadata, then fetches the IPFS JSON for the name.
 * Only returns the name — images come from the resolve API.
 */
export async function fetchLSP4Name(address: string): Promise<Partial<AddressIdentity> | null> {
  try {
    // Call getData(LSP4Metadata) on the contract
    const rpcRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: address, data: `0x54f6127f${LSP4_METADATA_KEY}` }, 'latest'],
        id: 1,
      }),
    })
    const rpcJson = await rpcRes.json()
    const result = rpcJson.result as string
    if (!result || result.length <= 66) return null

    // Decode ABI bytes
    const hex = result.slice(2)
    const length = parseInt(hex.slice(64, 128), 16)
    if (length === 0) return null
    const payload = hex.slice(128, 128 + length * 2)

    // Parse VerifiableURI: 00006f357c6a + 32-byte hash + UTF-8 URL
    let ipfsUrl = ''
    if (payload.startsWith('00006f357c6a')) {
      // Skip: hashFunction(4 chars) + hash(64 chars) = 68 chars after prefix
      const urlHex = payload.slice(4 + 4 + 64)
      ipfsUrl = hexToUtf8(urlHex)
    } else {
      ipfsUrl = hexToUtf8(payload)
    }
    if (!ipfsUrl) return null

    // Resolve IPFS URL
    const metaUrl = ipfsUrl.startsWith('ipfs://')
      ? `${IPFS_GATEWAY}/${ipfsUrl.slice(7)}`
      : ipfsUrl

    // Fetch metadata JSON — only need the name
    const metaRes = await fetch(metaUrl)
    if (!metaRes.ok) return null
    const meta = await metaRes.json()
    const lsp4 = meta.LSP4Metadata || meta

    if (!lsp4.name) return null
    return {
      address: address.toLowerCase(),
      lsp4TokenName: lsp4.name,
      description: lsp4.description || undefined,
    }
  } catch {
    return null
  }
}

function hexToUtf8(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}
