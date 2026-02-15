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
  const body: Record<string, unknown> = { chainId }
  if (address) body.address = address
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

const ENVIO_GRAPHQL = 'https://envio.lukso-mainnet.universal.tech/v1/graphql'

/**
 * Fetch token name from the Envio indexer.
 * Queries both the Asset table (direct) and Token table (LSP8 collection tokens).
 * Only returns the name — images come from the resolve API.
 */
export async function fetchTokenName(address: string): Promise<Partial<AddressIdentity> | null> {
  try {
    const lower = address.toLowerCase()

    // Query both Asset name and Token entries where this address is the tokenId
    const query = `{
      Asset_by_pk(id: "${lower}") {
        name
        description
      }
      Token(where: {asset_id: {_eq: "${lower}"}}, limit: 1) {
        name
        description
        lsp4TokenName
        lsp8ReferenceContract_id
      }
    }`

    const res = await fetch(ENVIO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    const data = await res.json()

    // Check Token table first (has individual moment/token names)
    const tokens = data.data?.Token
    if (tokens?.length) {
      const token = tokens[0]
      if (token.name || token.lsp4TokenName) {
        return {
          address: lower,
          // name = individual token name (e.g. "The Identity Layer")
          // lsp4TokenName = collection name (e.g. "Forever Moments")
          name: token.name || undefined,
          lsp4TokenName: token.lsp4TokenName || undefined,
          description: token.description || undefined,
        }
      }
    }

    // Fallback to Asset table
    const asset = data.data?.Asset_by_pk
    if (asset?.name) {
      return {
        address: lower,
        lsp4TokenName: asset.name,
        description: asset.description || undefined,
      }
    }

    return null
  } catch {
    return null
  }
}
