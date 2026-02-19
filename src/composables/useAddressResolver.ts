import { inject, computed } from 'vue'
import { ADDRESS_RESOLUTION_KEY, type AddressResolutionContext } from '@lukso/activity-sdk/vue'
import type { AddressIdentity } from '../lib/types'

/**
 * Thin wrapper around the SDK's address resolution inject.
 *
 * The SDK's useTransactionList() provides address resolution via Vue provide/inject.
 * This composable injects that context and exposes the same getIdentity() / queueResolve()
 * API that card components already use, so they don't need changes.
 */
export function useAddressResolver() {
  const ctx = inject<AddressResolutionContext>(ADDRESS_RESOLUTION_KEY as any)

  function getIdentity(address: string): AddressIdentity | undefined {
    if (!ctx) return undefined
    const lower = address.toLowerCase()
    const info = ctx.resolvedAddresses.value[lower]
    if (!info) return undefined
    // EnhancedInfo is a superset of AddressIdentity (has [key: string]: unknown)
    return info as unknown as AddressIdentity
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
