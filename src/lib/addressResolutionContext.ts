import type { InjectionKey, Ref } from 'vue'

// Local provide/inject contract between ActivityFeed (provider) and the cards
// (consumers via useAddressResolver). It mirrors the shape of
// `AddressResolutionContext` from `@lukso/activity-sdk/vue`, but is defined here
// because that entry point imports viem and the transaction decoder at module
// load — roughly half of the bundle — just to export a Symbol.

export type AddressResolutionKey = string | { address: string; tokenId: string }

export interface AddressResolutionContext {
  resolvedAddresses: Ref<Record<string, any>>
  requestResolution: (key: AddressResolutionKey) => void
  isResolving: (key: AddressResolutionKey) => boolean
}

export const ADDRESS_RESOLUTION_KEY: InjectionKey<AddressResolutionContext> = Symbol('address-resolution')
