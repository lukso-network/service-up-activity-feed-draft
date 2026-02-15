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

const FM_API = 'https://www.forevermoments.life/api/public/v1'
const IPFS_GATEWAY = 'https://api.universalprofile.cloud/ipfs'

/**
 * Fetch moment metadata from the Forever Moments public API.
 * Returns partial AddressIdentity with name, images, icons, description.
 */
export async function fetchForeverMoment(address: string): Promise<Partial<AddressIdentity> | null> {
  try {
    const res = await fetch(`${FM_API}/moments/${address}`)
    if (!res.ok) return null
    const data = await res.json()
    const moment = data.moment
    if (!moment) return null

    const resolveIpfs = (url: string) =>
      url?.startsWith('ipfs://') ? `${IPFS_GATEWAY}/${url.slice(7)}` : url

    const identity: Partial<AddressIdentity> = {
      address: address.toLowerCase(),
      lsp4TokenName: moment.title || undefined,
      description: moment.description || undefined,
    }

    // Use the moment image as the main image
    if (moment.images?.length) {
      identity.images = moment.images.map((url: string) => ({
        src: resolveIpfs(url),
        width: 0,
        height: 0,
      }))
    } else if (moment.image) {
      identity.images = [{ src: resolveIpfs(moment.image), width: 0, height: 0 }]
    }

    // Use icon
    if (moment.icon) {
      identity.icons = [{ src: resolveIpfs(moment.icon), width: 0, height: 0 }]
    }

    return identity
  } catch {
    return null
  }
}
