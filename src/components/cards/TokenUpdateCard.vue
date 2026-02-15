<template>
  <!-- Token metadata update: actor updated metadata of a token/NFT -->
  <ExtendedCard :tx="(tx as any)">
    <template #header>
      <!-- Actor (the UP that performed the update) -->
      <ProfileBadge
        :address="actorAddress"
        :name="actorIdentity?.name"
        :profile-url="actorProfileUrl"
        size="x-small"
      />

      <div class="basis-full h-0 sm:hidden"></div>

      <span class="text-sm text-neutral-500 dark:text-neutral-400">
        updated token metadata of
      </span>

      <!-- Token: icon + name (compact) or NFT preview -->
      <a
        v-if="!isNftToken"
        :href="`https://universaleverything.io/asset/${tokenAddress}`"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
      >
        <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenName" />
        <span>{{ tokenName || shortenAddress(tokenAddress) }}</span>
      </a>

      <TimeStamp :timestamp="tx.blockTimestamp" />
    </template>

    <template #content>
      <!-- NFT preview if it's an NFT -->
      <NftPreview v-if="isNftToken" :address="tokenAddress" :chain-id="chainId" />
    </template>
  </ExtendedCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl } from '../../lib/formatters'
import { EXECUTED_EVENT, findLogByEvent } from '../../lib/events'
import ExtendedCard from './ExtendedCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import NftPreview from '../shared/NftPreview.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()

// Actor: from Executed event (the UP), fallback to tx.from
const actorAddress = computed(() => {
  const executed = findLogByEvent(props.tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address
  return props.tx.from
})

// Token contract: tx.to (the contract setData was called on)
const tokenAddress = computed(() => props.tx.to)

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

// NFT if lsp4TokenType is 1 (NFT) or 2 (Collection)
const isNftToken = computed(() => {
  const tt = tokenIdentity.value?.lsp4TokenType
  return tt === 1 || tt === 2
})

function shortenAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
</script>
