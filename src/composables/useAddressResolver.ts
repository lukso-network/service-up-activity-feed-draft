import { reactive } from 'vue'
import { resolveAddresses, fetchForeverMoment } from '../lib/api'
import type { AddressIdentity } from '../lib/types'

const cache = reactive<Record<string, AddressIdentity>>({})
const pending = new Set<string>()
const fmPending = new Set<string>()
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
      // For unknown contracts without names, try Forever Moments API
      for (const addr of addresses) {
        const lower = addr.toLowerCase()
        const identity = cache[lower]
        if (identity && !identity.lsp4TokenName && !identity.name && !fmPending.has(lower)) {
          fmPending.add(lower)
          fetchForeverMoment(addr).then(meta => {
            if (meta) {
              const cached = cache[lower]
              if (meta.lsp4TokenName) cached.lsp4TokenName = meta.lsp4TokenName
              if (meta.description) cached.description = meta.description
              if (meta.icons?.length && !cached.icons?.length) cached.icons = meta.icons
              if (meta.images?.length && !cached.images?.length) cached.images = meta.images
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
