<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4">
    <!-- Header row -->
    <div class="flex gap-2">
      <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1">
        <ProfileBadge
          :address="actorAddress"
          :name="actorIdentity?.name"
          :profile-url="actorProfileUrl"
          size="x-small"
        />
        <div class="basis-full h-0 sm:hidden"></div>
        <span class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ isTokenIdUpdate ? 'updated NFT metadata' : 'updated collection metadata' }}
        </span>
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

    <!-- NFT card preview -->
    <div class="mt-3">
      <a
        :href="`https://universaleverything.io/asset/${tokenAddress}`"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-start gap-4 hover:opacity-90 transition-opacity no-underline"
      >
        <!-- Image -->
        <div class="flex-shrink-0 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          <div class="relative">
            <img
              v-if="nftImageUrl"
              :src="nftImageUrl"
              :alt="nftDisplayName"
              class="w-[140px] h-[140px] object-cover"
              loading="lazy"
            />
            <div v-else class="w-[140px] h-[140px] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <lukso-profile
                :profile-address="tokenAddress"
                has-identicon
                size="x-large"
              ></lukso-profile>
            </div>
          </div>
          <div class="px-2 py-1.5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
            <span class="text-xs text-neutral-500 font-mono">
              {{ isTokenIdUpdate ? decodedTokenId : shortenAddress(tokenAddress) }}
            </span>
          </div>
        </div>
        <!-- Details -->
        <div class="flex flex-col gap-1.5 min-w-0 py-1">
          <span class="text-lg font-bold text-neutral-800 dark:text-neutral-200 truncate">
            {{ nftDisplayName }}
          </span>
          <span v-if="isTokenIdUpdate && collectionName" class="text-sm text-neutral-400 dark:text-neutral-500">
            {{ collectionName }}
          </span>
          <!-- Creator -->
          <div v-if="creatorAddress" class="mt-1">
            <span class="text-xs text-neutral-400 dark:text-neutral-500">Created by</span>
            <div class="mt-1">
              <ProfileBadge
                :address="creatorAddress"
                :name="creatorIdentity?.name"
                :profile-url="creatorProfileUrl"
                size="x-small"
              />
            </div>
          </div>
        </div>
      </a>
    </div>

    <TxDetails v-if="detailsExpanded" :tx="(tx as any)" class="mt-3" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { shortenAddress, optimizeImageUrl } from '../../lib/formatters'
import { EXECUTED_EVENT, findLogByEvent } from '../../lib/events'
import { autoDecodeTokenId } from '../../lib/tokenId'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import TxDetails from '../shared/TxDetails.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()
const detailsExpanded = ref(false)

// ─── Shared logic ───

const isTokenIdUpdate = computed(() =>
  props.tx.functionName?.toLowerCase().includes('setdatafortokenid')
)

const actorAddress = computed(() => {
  const executed = findLogByEvent(props.tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address
  return props.tx.from
})

const tokenAddress = computed(() => props.tx.to)

// ─── Token ID decoding ───
const rawTokenId = computed(() => {
  const arg = props.tx.args?.find(a => a.name === 'tokenId')
  return arg?.value ? String(arg.value) : null
})

const decodedTokenId = computed(() => {
  if (!rawTokenId.value) return ''
  // TODO: when we have LSP8TokenIdFormat from the contract, pass it to decodeTokenId()
  // For now, auto-detect works for most cases
  return autoDecodeTokenId(rawTokenId.value).display
})

// ─── Per-token metadata (from children[0].info.value) ───
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

// ─── Collection identity (from resolve API) ───
const collectionIdentity = computed(() => getIdentity(tokenAddress.value))

// ─── NFT image: per-token from metadata, or collection from resolve API ───
const nftImageUrl = computed(() => {
  if (isTokenIdUpdate.value && tokenMetadata.value) {
    // Per-token: image from decoded LSP4Metadata in children
    const meta = tokenMetadata.value
    if (meta.images?.length) {
      const firstSet = Array.isArray(meta.images[0]) ? meta.images[0] : [meta.images[0]]
      if (firstSet.length) {
        const sorted = [...firstSet].sort((a: any, b: any) => (a.width || 0) - (b.width || 0))
        const img = sorted.find((i: any) => (i.width || 0) >= 140) || sorted[sorted.length - 1]
        if (img?.url) {
          const url = img.url.startsWith('ipfs://')
            ? `https://api.universalprofile.cloud/ipfs/${img.url.slice(7)}`
            : img.url
          return optimizeImageUrl(url, 280)
        }
      }
    }
  }
  // Collection level: from resolve API
  const images = collectionIdentity.value?.images
  if (images?.length) {
    const sorted = [...(images || [])].sort((a: any, b: any) => (a.width || 0) - (b.width || 0))
    return optimizeImageUrl((sorted.find((i: any) => (i.width || 0) >= 140) || sorted[sorted.length - 1]).src, 280)
  }
  const icons = collectionIdentity.value?.icons
  if (icons?.length) {
    const sorted = [...(icons || [])].sort((a: any, b: any) => (a.width || 0) - (b.width || 0))
    return optimizeImageUrl((sorted.find((i: any) => (i.width || 0) >= 140) || sorted[sorted.length - 1]).src, 280)
  }
  return ''
})

// ─── Display name ───
const nftDisplayName = computed(() => {
  if (isTokenIdUpdate.value && tokenMetadata.value?.name) {
    return tokenMetadata.value.name
  }
  // Collection name from resolve API
  return collectionIdentity.value?.lsp4TokenName
    || collectionIdentity.value?.lsp4TokenSymbol
    || collectionIdentity.value?.name
    || 'NFT'
})

const collectionName = computed(() =>
  collectionIdentity.value?.lsp4TokenName || collectionIdentity.value?.name || ''
)

// ─── Creator ───
const creatorAddress = computed(() => {
  const creators = (collectionIdentity.value as any)?.lsp4Creators
  if (creators?.length) return creators[0].profile_id || creators[0].address || ''
  return collectionIdentity.value?.owner_id || ''
})

const creatorIdentity = computed(() => {
  const addr = creatorAddress.value
  if (!addr) return undefined
  const id = getIdentity(addr)
  if (!id) queueResolve(props.chainId, [addr])
  return id
})

const creatorProfileUrl = computed(() => {
  const images = creatorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

// ─── Actor ───
const actorIdentity = computed(() => getIdentity(actorAddress.value))
const actorProfileUrl = computed(() => {
  const images = actorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})
</script>
