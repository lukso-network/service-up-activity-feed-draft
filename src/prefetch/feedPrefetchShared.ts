// Contract between the inline first-page prefetch in index.html
// (feedPrefetch.inline.ts) and the app's GraphQL client (lib/feedApi.ts).
//
// The inline script starts the newest-page request while the browser is still
// downloading the app bundle. The app adopts that in-flight response only when
// it builds the same endpoint URL and byte-identical body; any mismatch (another
// route, a changed query) or failure falls through to a normal fetch.

import {
  DEFAULT_CHAIN_ID,
  LUKSO_MAINNET_CHAIN_ID,
  LUKSO_TESTNET_CHAIN_ID,
  feedApiUrl,
} from '../lib/chains'
import {
  FEED_PAGE_SIZE,
  buildGlobalFeedRequest,
  buildProfileFeedRequest,
  serializeGraphqlRequest,
} from '../lib/feedQuery'

/** Lowercase on purpose: buildProfileFeedRequest lowercases the profile id. */
const PROFILE_PLACEHOLDER = '__prefetch_profile_id__'

/** Build-time data baked into the inline script (see vite.config.ts). */
export interface FeedPrefetchConfig {
  /** Indexer endpoint per supported chain id. */
  endpoints: Record<string, string>
  defaultChainId: number
  testnetChainId: number
  /** POST body of the newest global page. */
  globalBody: string
  /** POST body of a newest profile page with `placeholder` for the address. */
  profileBodyTemplate: string
  placeholder: string
}

export interface PrefetchedResponse {
  ok: boolean
  status: number
  statusText: string
  text: string
}

export interface FeedPrefetchHandle {
  url: string
  body: string
  /** Resolves to null when the request failed at the network level. */
  response: Promise<PrefetchedResponse | null>
}

declare global {
  interface Window {
    __FEED_PREFETCH__?: FeedPrefetchHandle
  }
}

export function buildFeedPrefetchConfig(): FeedPrefetchConfig {
  const profileBodyTemplate = serializeGraphqlRequest(
    buildProfileFeedRequest(PROFILE_PLACEHOLDER, FEED_PAGE_SIZE),
  )
  if (profileBodyTemplate.split(PROFILE_PLACEHOLDER).length !== 2) {
    throw new Error('Profile prefetch template must contain the placeholder exactly once')
  }
  return {
    endpoints: {
      [LUKSO_MAINNET_CHAIN_ID]: feedApiUrl(LUKSO_MAINNET_CHAIN_ID),
      [LUKSO_TESTNET_CHAIN_ID]: feedApiUrl(LUKSO_TESTNET_CHAIN_ID),
    },
    defaultChainId: DEFAULT_CHAIN_ID,
    testnetChainId: LUKSO_TESTNET_CHAIN_ID,
    globalBody: serializeGraphqlRequest(buildGlobalFeedRequest(FEED_PAGE_SIZE)),
    profileBodyTemplate,
    placeholder: PROFILE_PLACEHOLDER,
  }
}

/**
 * Hand over the prefetched response if it was made for exactly this request.
 * Single use: the handle is cleared on the first lookup, match or not, so a
 * later request (refresh, another route) always goes to the network.
 */
export function takePrefetchedResponse(
  url: string,
  body: string,
): Promise<PrefetchedResponse | null> | undefined {
  if (typeof window === 'undefined') return undefined
  const handle = window.__FEED_PREFETCH__
  if (!handle) return undefined
  delete window.__FEED_PREFETCH__
  if (handle.url !== url || handle.body !== body) return undefined
  return handle.response
}
