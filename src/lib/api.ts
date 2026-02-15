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

const FM_API = 'https://www.forevermoments.life/api/moments'

/**
 * Fetch moment title from the Forever Moments API.
 * Only used for the name — images/icons come from the resolve API.
 */
export async function fetchForeverMoment(address: string): Promise<Partial<AddressIdentity> | null> {
  try {
    const res = await fetch(`${FM_API}/${address}`)
    if (!res.ok) return null
    const data = await res.json()
    const moment = data.moment
    if (!moment?.title) return null

    return {
      address: address.toLowerCase(),
      lsp4TokenName: moment.title,
      description: moment.description || undefined,
    }
  } catch {
    return null
  }
}
