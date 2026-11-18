// Inline first-page prefetch, injected into index.html by the `feed-prefetch`
// plugin in vite.config.ts. It is not imported by the app: the plugin compiles
// this file on its own (esbuild transform, no bundling) and substitutes
// __FEED_PREFETCH_CONFIG__ with build-time data, so it must stay self-contained
// — type-only imports are fine, runtime imports are not.
//
// Runs during HTML parsing, before the app bundle has downloaded, so the feed
// request overlaps the bundle download instead of starting after it. The route
// parsing mirrors src/router/index.ts and ActivityFeed's chain normalisation; if
// it ever drifts, the app simply doesn't reuse the response (see
// takePrefetchedResponse) and fetches normally.

import type { FeedPrefetchConfig, PrefetchedResponse } from './feedPrefetchShared'

declare const __FEED_PREFETCH_CONFIG__: FeedPrefetchConfig

function startFeedPrefetch(config: FeedPrefetchConfig): void {
  try {
    const ADDRESS = '(0x[0-9a-fA-F]{40})'
    const location = window.location
    let chainId = config.defaultChainId
    let profileId = ''
    let match: RegExpExecArray | null

    // Legacy hash URLs (/#/42/0x…, /#0x…) are migrated by the router's beforeEach.
    const hash = location.hash.replace(/^#\/?/, '')
    const path = location.pathname.replace(/\/+$/, '') || '/'

    if ((match = new RegExp(`^(\\d+)\\/${ADDRESS}$`).exec(hash))) {
      chainId = Number(match[1])
      profileId = match[2]
    } else if ((match = new RegExp(`^${ADDRESS}$`).exec(hash))) {
      profileId = match[1]
    } else if ((match = new RegExp(`^\\/(\\d+)\\/${ADDRESS}$`, 'i').exec(path))) {
      chainId = Number(match[1])
      profileId = match[2]
    } else if ((match = new RegExp(`^\\/${ADDRESS}$`, 'i').exec(path))) {
      profileId = match[1]
    } else if ((match = /^\/(\d+)$/.exec(path))) {
      chainId = Number(match[1])
    } else if (path !== '/') {
      return // Not a feed route.
    }

    // Same as normalizeChainId(): testnet stays testnet, everything else is mainnet.
    chainId = chainId === config.testnetChainId ? config.testnetChainId : config.defaultChainId
    const url = config.endpoints[chainId]
    if (!url) return

    const body = profileId
      ? config.profileBodyTemplate.split(config.placeholder).join(profileId.toLowerCase())
      : config.globalBody

    // text/plain keeps this a CORS "simple request", so the browser skips the
    // OPTIONS preflight round trip (the indexer sends no Access-Control-Max-Age,
    // so preflights are barely cached). Hasura parses the JSON body regardless;
    // should that ever change, the app sees a failed prefetch and refetches.
    const response: Promise<PrefetchedResponse | null> = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    })
      .then((res) => res.text().then((text) => ({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        text,
      })))
      .catch(() => null)

    window.__FEED_PREFETCH__ = { url, body, response }
  } catch {
    // Best effort only — the app fetches on its own when no prefetch exists.
  }
}

startFeedPrefetch(__FEED_PREFETCH_CONFIG__)
