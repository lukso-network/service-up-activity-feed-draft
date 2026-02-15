import { reactive } from 'vue'
import { resolveAddresses, fetchLSP4Metadata } from '../lib/api'
import type { AddressIdentity } from '../lib/types'

const cache = reactive<Record<string, AddressIdentity>>({})
const pending = new Set<string>()
const lsp4Pending = new Set<string>()
let batchTimer: ReturnType<typeof setTimeout> | null = null
let batchAddresses: string[] = []
let batchChainId = 42

export function useAddressResolver() {
  function getIdentity(address: string): AddressIdentity | undefined {
    return cache[address.toLowerCase()]
  }

  function queueResolve(chainId: number, addresses: string[]) {
    batchChainId = chainId
    for (const addr of addresses) {
      const lower = addr.toLowerCase()
      if (!cache[lower] && !pending.has(lower)) {
        pending.add(lower)
        batchAddresses.push(lower)
      }
    }

    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = setTimeout(flushBatch, 100)
  }

  async function flushBatch() {
    if (batchAddresses.length === 0) return
    const addresses = [...batchAddresses]
    batchAddresses = []

    try {
      const res = await resolveAddresses(batchChainId, addresses)
      for (const [addr, identity] of Object.entries(res.addressIdentities)) {
        cache[addr.toLowerCase()] = identity
      }
      // For addresses that resolved but have no name (UnknownContract etc.),
      // try fetching LSP4Metadata directly from on-chain
      for (const addr of addresses) {
        const lower = addr.toLowerCase()
        const identity = cache[lower]
        if (identity && !identity.lsp4TokenName && !identity.name && !lsp4Pending.has(lower)) {
          lsp4Pending.add(lower)
          fetchLSP4Metadata(addr).then(meta => {
            if (meta) {
              // Merge on-chain metadata into the cached identity
              if (meta.lsp4TokenName) cache[lower].lsp4TokenName = meta.lsp4TokenName
              if (meta.description) cache[lower].description = meta.description
              if (meta.icons?.length) cache[lower].icons = meta.icons
              if (meta.images?.length) cache[lower].images = meta.images
            }
          })
        }
      }
    } catch {
      // Silently fail - addresses just won't be resolved
    } finally {
      for (const addr of addresses) {
        pending.delete(addr)
      }
    }
  }

  function resolveFromTransaction(chainId: number, from: string, to: string) {
    queueResolve(chainId, [from, to])
  }

  return {
    getIdentity,
    queueResolve,
    resolveFromTransaction,
    cache,
  }
}
