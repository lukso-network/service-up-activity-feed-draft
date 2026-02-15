<template>
  <!-- Token metadata update: actor updated metadata of a token/NFT -->
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4">
    <!-- Header row -->
    <div class="flex gap-2">
      <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1">
        <!-- Actor (the UP that performed the update) -->
        <ProfileBadge
          :address="actorAddress"
          :name="actorIdentity?.name"
          :profile-url="actorProfileUrl"
          size="x-small"
        />

        <div class="basis-full h-0 sm:hidden"></div>

        <span class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ isTokenIdUpdate ? 'updated NFT metadata' : 'updated token metadata of' }}
        </span>

        <!-- Token icon + name for collection-level updates -->
        <a
          v-if="!isTokenIdUpdate"
          :href="`https://universaleverything.io/asset/${tokenAddress}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenName" />
          <span>{{ tokenName || shortenAddress(tokenAddress) }}</span>
        </a>

        <TimeStamp :timestamp="tx.blockTimestamp" />
      </div>
      <button
        @click="detailsExpanded = !detailsExpanded"
        class="flex-shrink-0 self-start mt-1 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all"
      >
        <svg
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': detailsExpanded }"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>

    <!-- NFT preview for setDataForTokenId — show the specific token's image -->
    <div v-if="isTokenIdUpdate && tokenImage" class="mt-3">
      <a
        :href="`https://universaleverything.io/asset/${tokenAddress}`"
        target="_blank"
        rel="noopener noreferrer"
        class="block"
      >
        <img
          :src="tokenImage"
          :alt="tokenIdName || 'NFT'"
          class="w-full max-w-[280px] rounded-xl object-cover"
        />
      </a>
      <div class="mt-2 text-sm">
        <span v-if="tokenIdName" class="font-medium text-neutral-800 dark:text-neutral-200">{{ tokenIdName }}</span>
        <span v-if="collectionName" class="text-neutral-400 dark:text-neutral-500 ml-1">{{ collectionName }}</span>
      </div>
    </div>

    <!-- Expanded details -->
    <TxDetails v-if="detailsExpanded" :tx="(tx as any)" class="mt-3" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl } from '../../lib/formatters'
import { EXECUTED_EVENT, findLogByEvent } from '../../lib/events'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import TxDetails from '../shared/TxDetails.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()
const detailsExpanded = ref(false)

// Is this a per-token update (setDataForTokenId) vs collection-level (setData)?
const isTokenIdUpdate = computed(() =>
  props.tx.functionName?.toLowerCase().includes('setdatafortokenid')
)

// Actor: from Executed event (the UP), fallback to tx.from
const actorAddress = computed(() => {
  const executed = findLogByEvent(props.tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address
  return props.tx.from
})

// Token contract address
const tokenAddress = computed(() => props.tx.to)

// Extract token image from children[0].info.value.images (decoded LSP4Metadata)
const tokenMetadata = computed(() => {
  const children = props.tx.children
  if (children?.length) {
    for (const child of children) {
      const info = (child as any).info
      if (info?.value) return info.value
    }
  }
  return null
})

const tokenImage = computed(() => {
  const meta = tokenMetadata.value
  if (!meta?.images?.length) return ''
  // images is array of image sets — first set, find a reasonable size
  const firstSet = Array.isArray(meta.images[0]) ? meta.images[0] : [meta.images[0]]
  if (!firstSet.length) return ''
  // Sort by width, pick one around 300px
  const sorted = [...firstSet].sort((a: any, b: any) => (a.width || 0) - (b.width || 0))
  const img = sorted.find((i: any) => (i.width || 0) >= 280) || sorted[sorted.length - 1]
  if (!img?.url) return ''
  // Convert IPFS to gateway
  const url = img.url.startsWith('ipfs://')
    ? `https://api.universalprofile.cloud/ipfs/${img.url.slice(7)}`
    : img.url
  return optimizeImageUrl(url, 560)
})

// Token name from metadata or resolve API
const tokenIdName = computed(() => {
  // From Envio or resolve API for the specific token
  const meta = tokenMetadata.value
  if (meta?.name) return meta.name
  return null
})

const collectionName = computed(() => {
  const identity = getIdentity(tokenAddress.value)
  return identity?.lsp4TokenName || identity?.name || ''
})

const actorIdentity = computed(() => getIdentity(actorAddress.value))
const actorProfileUrl = computed(() => {
  const images = actorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

const tokenIdentity = computed(() => getIdentity(tokenAddress.value))
const tokenName = computed(() =>
  tokenIdentity.value?.lsp4TokenSymbol || tokenIdentity.value?.lsp4TokenName || tokenIdentity.value?.name || ''
)
const tokenIconUrl = computed(() => {
  const icons = tokenIdentity.value?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a: any, b: any) => (a.width || 0) - (b.width || 0))
    return optimizeImageUrl((sorted.find((i: any) => (i.width || 0) >= 32) || sorted[0]).src, 32)
  }
  return ''
})

function shortenAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
</script>
