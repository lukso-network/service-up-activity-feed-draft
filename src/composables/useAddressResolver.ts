import { inject, computed, reactive, watch } from 'vue'
import { ADDRESS_RESOLUTION_KEY, type AddressResolutionContext } from '@lukso/activity-sdk/vue'
import type { AddressIdentity } from '../lib/types'
import { fetchProfileTags, fetchAssetTokenIdFormats } from '../lib/api'

/**
 * Thin wrapper around the SDK's address resolution inject.
 *
 * The SDK's useTransactionList() provides address resolution via Vue provide/inject.
 * This composable injects that context and exposes the same getIdentity() / queueResolve()
 * API that card components already use, so they don't need changes.
 */

// Global tags cache shared across all composable instances
const tagsCache = reactive<Record<string, string[]>>({})
const tagsFetched = new Set<string>()
let tagsBatchTimer: ReturnType<typeof setTimeout> | null = null
const tagsBatchQueue = new Set<string>()

// Global lsp8TokenIdFormat cache for asset addresses
const tokenIdFormatCache = reactive<Record<string, number>>({})
const tokenIdFormatFetched = new Set<string>()
let tokenIdFormatBatchTimer: ReturnType<typeof setTimeout> | null = null
const tokenIdFormatBatchQueue = new Set<string>()

function queueTagsFetch(addresses: string[]) {
  for (const addr of addresses) {
    const lower = addr.toLowerCase()
    if (!tagsFetched.has(lower)) {
      tagsBatchQueue.add(lower)
    }
  }
  if (tagsBatchQueue.size > 0 && !tagsBatchTimer) {
    tagsBatchTimer = setTimeout(flushTagsBatch, 100)
  }
}

async function flushTagsBatch() {
  tagsBatchTimer = null
  const batch = [...tagsBatchQueue]
  tagsBatchQueue.clear()
  if (!batch.length) return
  for (const addr of batch) tagsFetched.add(addr)
  try {
    const result = await fetchProfileTags(batch)
    for (const [addr, tags] of Object.entries(result)) {
      tagsCache[addr.toLowerCase()] = tags
    }
  } catch {
    // Allow retry on failure
    for (const addr of batch) tagsFetched.delete(addr)
  }
}

function queueTokenIdFormatFetch(addresses: string[]) {
  for (const addr of addresses) {
    const lower = addr.toLowerCase()
    if (!tokenIdFormatFetched.has(lower)) {
      tokenIdFormatBatchQueue.add(lower)
    }
  }
  if (tokenIdFormatBatchQueue.size > 0 && !tokenIdFormatBatchTimer) {
    tokenIdFormatBatchTimer = setTimeout(flushTokenIdFormatBatch, 100)
  }
}

async function flushTokenIdFormatBatch() {
  tokenIdFormatBatchTimer = null
  const batch = [...tokenIdFormatBatchQueue]
  tokenIdFormatBatchQueue.clear()
  if (!batch.length) return
  for (const addr of batch) tokenIdFormatFetched.add(addr)
  try {
    const result = await fetchAssetTokenIdFormats(batch)
    for (const [addr, format] of Object.entries(result)) {
      tokenIdFormatCache[addr.toLowerCase()] = format
    }
  } catch {
    for (const addr of batch) tokenIdFormatFetched.delete(addr)
  }
}

export function useAddressResolver() {
  const ctx = inject<AddressResolutionContext>(ADDRESS_RESOLUTION_KEY as any)

  // Watch for new resolved addresses and fetch their tags
  if (ctx) {
    watch(() => Object.keys(ctx.resolvedAddresses.value), (keys) => {
      const profileAddrs: string[] = []
      const assetAddrs: string[] = []
      for (const addr of keys) {
        const info = ctx.resolvedAddresses.value[addr]
        if (!info) continue
        const gqlType = (info as any).__gqltype
        if (gqlType === 'Profile') profileAddrs.push(addr)
        else if (gqlType === 'Asset') assetAddrs.push(addr)
      }
      if (profileAddrs.length) queueTagsFetch(profileAddrs)
      if (assetAddrs.length) queueTokenIdFormatFetch(assetAddrs)
    }, { immediate: true })
  }

  function getIdentity(address: string): AddressIdentity | undefined {
    if (!ctx) return undefined
    const lower = address.toLowerCase()
    const info = ctx.resolvedAddresses.value[lower]
    if (!info) return undefined
    // EnhancedInfo is a superset of AddressIdentity (has [key: string]: unknown)
    const identity = info as unknown as AddressIdentity
    // Enrich with tags from Envio if available
    if (tagsCache[lower]) {
      identity.tags = tagsCache[lower]
    }
    // Enrich with lsp8TokenIdFormat from Envio if available
    if (tokenIdFormatCache[lower] != null) {
      identity.lsp8TokenIdFormat = tokenIdFormatCache[lower]
    }
    return identity
  }

  function queueResolve(_chainId: number, addresses: string[]) {
    if (!ctx) return
    for (const addr of addresses) {
      ctx.requestResolution(addr.toLowerCase())
    }
  }

  function resolveFromTransaction(_chainId: number, from: string, to: string) {
    queueResolve(0, [from, to])
  }

  const cache = computed(() => {
    if (!ctx) return {} as Record<string, AddressIdentity>
    // Return the raw resolved map cast to AddressIdentity
    return ctx.resolvedAddresses.value as unknown as Record<string, AddressIdentity>
  })

  return {
    getIdentity,
    queueResolve,
    resolveFromTransaction,
    cache,
  }
}
