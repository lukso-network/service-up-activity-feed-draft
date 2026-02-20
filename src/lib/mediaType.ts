/**
 * Cache of URL -> media type ('video' | 'image' | 'unknown')
 * Persists for the session to avoid repeated HEAD requests.
 */
const mediaTypeCache = new Map<string, 'video' | 'image' | 'unknown'>()
const pendingRequests = new Map<string, Promise<'video' | 'image' | 'unknown'>>()

/**
 * Strip query params from a URL to get the base resource URL.
 */
export function stripQueryParams(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|mov|avi|mkv)$/i
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i

/**
 * Detect media type from URL extension alone.
 */
export function detectMediaTypeFromUrl(url: string): 'video' | 'image' | 'unknown' {
  if (!url) return 'unknown'
  try {
    const pathname = new URL(url).pathname
    if (VIDEO_EXTENSIONS.test(pathname)) return 'video'
    if (IMAGE_EXTENSIONS.test(pathname)) return 'image'
  } catch { /* ignore */ }
  return 'unknown'
}

/**
 * Detect media type via URL extension first, then HTTP HEAD request fallback.
 * Returns 'video', 'image', or 'unknown'.
 * Results are cached per base URL.
 */
export async function detectMediaType(url: string): Promise<'video' | 'image' | 'unknown'> {
  const baseUrl = stripQueryParams(url)
  if (!baseUrl) return 'unknown'

  // Check cache
  const cached = mediaTypeCache.get(baseUrl)
  if (cached) return cached

  // Check URL extension first (no network needed)
  const fromExt = detectMediaTypeFromUrl(baseUrl)
  if (fromExt !== 'unknown') {
    mediaTypeCache.set(baseUrl, fromExt)
    return fromExt
  }

  // Deduplicate in-flight requests
  const pending = pendingRequests.get(baseUrl)
  if (pending) return pending

  const promise = (async () => {
    try {
      const res = await fetch(baseUrl, { method: 'HEAD' })
      const contentType = res.headers.get('content-type') || ''
      let type: 'video' | 'image' | 'unknown' = 'unknown'
      if (contentType.startsWith('video/')) {
        type = 'video'
      } else if (contentType.startsWith('image/')) {
        type = 'image'
      }
      mediaTypeCache.set(baseUrl, type)
      return type
    } catch {
      mediaTypeCache.set(baseUrl, 'unknown')
      return 'unknown' as const
    } finally {
      pendingRequests.delete(baseUrl)
    }
  })()

  pendingRequests.set(baseUrl, promise)
  return promise
}
