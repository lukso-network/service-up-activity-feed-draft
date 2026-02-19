import type { AddressIdentity } from './types'

const ENVIO_GRAPHQL = 'https://envio.lukso-mainnet.universal.tech/v1/graphql'

/**
 * Fetch token name from the Envio indexer.
 * Queries both the Asset table (direct) and Token table (LSP8 collection tokens).
 * Only returns the name — images come from the resolve API.
 */
export interface TokenAsset {
  src: string
  url?: string
  fileType?: string
}

export async function fetchTokenName(address: string): Promise<(Partial<AddressIdentity> & { assets?: TokenAsset[] }) | null> {
  try {
    const lower = address.toLowerCase()

    // Query both Asset name and Token entries where this address is the tokenId
    const query = `{
      Asset_by_pk(id: "${lower}") {
        name
        description
        assets { src url fileType }
      }
      Token(where: {asset_id: {_eq: "${lower}"}}, limit: 1) {
        name
        description
        lsp4TokenName
        lsp8ReferenceContract_id
        assets { src url fileType }
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
          name: token.name || undefined,
          lsp4TokenName: token.lsp4TokenName || undefined,
          description: token.description || undefined,
          assets: token.assets || undefined,
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
        assets: asset.assets || undefined,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Fetch FM moment by block number from Envio indexer.
 * Matches the created moment to the transaction's block.
 */
export async function fetchFMomentByBlock(
  collectionAddress: string,
  blockNumber: number
): Promise<{ asset_id: string; name: string; lsp4TokenName: string } | null> {
  try {
    const lower = collectionAddress.toLowerCase()
    const query = `{
      Token(
        where: {
          lsp8ReferenceContract_id: { _eq: "${lower}" }
          createdBlockNumber: { _eq: ${blockNumber} }
        }
        limit: 1
      ) {
        asset_id
        name
        lsp4TokenName
      }
    }`

    const res = await fetch(ENVIO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const tokens = data.data?.Token
    return tokens?.length ? tokens[0] : null
  } catch {
    return null
  }
}

/**
 * Fetch per-token metadata (images, name) from the Envio indexer.
 * For LSP8 collections, each tokenId can have its own metadata set via setDataForTokenId.
 *
 * @param collectionAddress - The LSP8 collection contract address
 * @param tokenId - The raw bytes32 tokenId (0x-prefixed)
 * @returns Token images and name, or null if not found
 */
export async function fetchTokenIdMetadata(
  collectionAddress: string,
  tokenId: string
): Promise<{ images: Array<{ src: string; width: number | null; height: number | null }>; icons: Array<{ src: string; width: number | null; height: number | null }>; name: string | null; assetId: string | null; assets: TokenAsset[] } | null> {
  try {
    const lower = collectionAddress.toLowerCase()
    const tokenIdLower = tokenId.toLowerCase()

    const query = `{
      Token(where: {
        lsp8ReferenceContract_id: { _eq: "${lower}" }
        tokenId: { _eq: "${tokenIdLower}" }
      }, limit: 1) {
        asset_id
        name
        images { src width height }
        icons { src width height }
        assets { src url fileType }
      }
    }`

    const res = await fetch(ENVIO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const tokens = data.data?.Token
    if (!tokens?.length) return null
    const token = tokens[0]
    return {
      images: token.images || [],
      icons: token.icons || [],
      name: token.name || null,
      assetId: token.asset_id || null,
      assets: token.assets || [],
    }
  } catch {
    return null
  }
}

const LIKES_CONTRACT = '0x403bfd53617555295347e0f7725cfda480ab801e'

/**
 * Fetch LIKES token balance for an address from Envio indexer.
 * Returns formatted whole number (decimals=18).
 */
export async function fetchLikesBalance(address: string): Promise<string | null> {
  try {
    const lower = address.toLowerCase()
    const query = `{
      Hold(where: {
        asset_id: { _eq: "${LIKES_CONTRACT}" }
        profile_id: { _eq: "${lower}" }
      }, limit: 1) {
        balance
      }
    }`

    const res = await fetch(ENVIO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const holds = data.data?.Hold
    if (!holds?.length) return '0'
    const raw = BigInt(holds[0].balance)
    const whole = raw / 10n ** 18n
    return whole.toLocaleString()
  } catch {
    return null
  }
}
