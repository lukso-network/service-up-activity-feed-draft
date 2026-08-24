// LUKSO chain constants and the indexer endpoint each chain reads from.

export const LUKSO_MAINNET_CHAIN_ID = 42
export const LUKSO_TESTNET_CHAIN_ID = 4201

/** Routes without an explicit chain (e.g. `/0x...`, `/`) fall back to mainnet. */
export const DEFAULT_CHAIN_ID = LUKSO_MAINNET_CHAIN_ID

const FEED_API_URLS: Record<number, string> = {
  [LUKSO_MAINNET_CHAIN_ID]: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  [LUKSO_TESTNET_CHAIN_ID]: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
}

/** Keep every chain-aware consumer aligned with the two supported feed networks. */
export function normalizeChainId(chainId?: number): number {
  return chainId === LUKSO_TESTNET_CHAIN_ID
    ? LUKSO_TESTNET_CHAIN_ID
    : LUKSO_MAINNET_CHAIN_ID
}

/**
 * Envio GraphQL endpoint for a chain. Unknown or missing chain ids fall back to
 * mainnet so a malformed route renders the mainnet feed instead of erroring.
 */
export function feedApiUrl(chainId?: number): string {
  return FEED_API_URLS[normalizeChainId(chainId)]
}
