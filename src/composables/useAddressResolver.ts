import { reactive } from 'vue'
import { resolveAddresses } from '../lib/api'
import type { AddressIdentity } from '../lib/types'

const cache = reactive<Record<string, AddressIdentity>>({})
const pending = new Set<string>()
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
