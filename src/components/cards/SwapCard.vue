<template>
  <CompactCard :tx="(tx as any)">
    <!-- Actor (the UP that initiated the swap) -->
    <ProfileBadge
      :address="actorAddress"
      :name="actorIdentity?.name"
      :profile-url="actorProfileUrl"
      :is-e-o-a="actorIsEOA"
      :is-bot="actorIsBot"
      size="x-small"
    />

    <div class="basis-full h-0 sm:hidden"></div>

    <!-- Action text + token pair -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1 flex-wrap">
      swapped
      <component
        :is="inputLinkTag"
        v-bind="inputLinkAttrs"
        class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200"
        :class="inputLinkClass"
      >
        <span v-if="swap.input.formattedAmount">{{ swap.input.formattedAmount }}</span>
        <img v-if="inputIconUrl" :src="inputIconUrl" class="w-4 h-4 rounded-full" :alt="inputSymbolDisplay" />
        <span>{{ inputSymbolDisplay }}</span>
      </component>
      for
      <component
        :is="outputLinkTag"
        v-bind="outputLinkAttrs"
        class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200"
        :class="outputLinkClass"
      >
        <span v-if="swap.output.formattedAmount">{{ swap.output.formattedAmount }}</span>
        <img v-if="outputIconUrl" :src="outputIconUrl" class="w-4 h-4 rounded-full" :alt="outputSymbolDisplay" />
        <span>{{ outputSymbolDisplay }}</span>
      </component>
      on
      <a
        href="https://contracts.phlox.finance/"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
      >
        <img src="/phlox-icon.svg" class="w-4 h-4" alt="" aria-hidden="true" />
        <span>Phlox</span>
      </a>
    </span>

    <!-- Recipient line (only when the destination differs from the actor) -->
    <template v-if="hasDifferentRecipient">
      <div class="basis-full h-0 sm:hidden"></div>
      <span class="text-sm text-neutral-500 dark:text-neutral-400">to</span>
      <ProfileBadge
        :address="recipientAddress"
        :name="recipientIdentity?.name"
        :profile-url="recipientProfileUrl"
        :is-e-o-a="recipientIsEOA"
        :is-bot="recipientIsBot"
        size="x-small"
      />
    </template>

    <TimeStamp :timestamp="tx.blockTimestamp" />
  </CompactCard>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { PHLOX_LYX_ASSET, PHLOX } from '../../lib/phlox'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl } from '../../lib/formatters'
import { isEOA as checkIsEOA, isBot as checkIsBot } from '../../lib/eoa'
import CompactCard from './CompactCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

// Non-null swap descriptor — this card is only rendered when classifyTransaction
// returns 'phlox_swap', which requires tx.phloxSwap to be set.
const swap = computed(() => props.tx.phloxSwap!)

const actorAddress = computed(() => swap.value.actor)
const recipientAddress = computed(() => swap.value.recipient || swap.value.actor)
const hasDifferentRecipient = computed(() =>
  recipientAddress.value && recipientAddress.value.toLowerCase() !== actorAddress.value.toLowerCase(),
)

const actorIdentity = computed(() => getIdentity(actorAddress.value))
const actorIsEOA = computed(() => checkIsEOA(actorIdentity.value))
const actorIsBot = computed(() => checkIsBot(actorIdentity.value))
const actorProfileUrl = computed(() => avatarUrlFromIdentity(actorIdentity.value))

const recipientIdentity = computed(() => hasDifferentRecipient.value ? getIdentity(recipientAddress.value) : undefined)
const recipientIsEOA = computed(() => checkIsEOA(recipientIdentity.value))
const recipientIsBot = computed(() => checkIsBot(recipientIdentity.value))
const recipientProfileUrl = computed(() => avatarUrlFromIdentity(recipientIdentity.value))

function avatarUrlFromIdentity(identity: ReturnType<typeof getIdentity>): string {
  const images = identity?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
}

const inputIdentity = computed(() => isLyxAsset(swap.value.input.address) ? undefined : getIdentity(swap.value.input.address))
const outputIdentity = computed(() => isLyxAsset(swap.value.output.address) ? undefined : getIdentity(swap.value.output.address))

function isLyxAsset(addr: string): boolean {
  if (!addr) return false
  const lower = addr.toLowerCase()
  return lower === PHLOX_LYX_ASSET || lower === PHLOX.WLYX
}

const inputSymbolDisplay = computed(() => {
  if (isLyxAsset(swap.value.input.address)) return 'LYX'
  return inputIdentity.value?.lsp4TokenSymbol
    || inputIdentity.value?.lsp4TokenName
    || swap.value.input.symbol
    || 'Token'
})

const outputSymbolDisplay = computed(() => {
  if (isLyxAsset(swap.value.output.address)) return 'LYX'
  return outputIdentity.value?.lsp4TokenSymbol
    || outputIdentity.value?.lsp4TokenName
    || swap.value.output.symbol
    || 'Token'
})

function tokenIconFromIdentity(identity: ReturnType<typeof getIdentity>): string {
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
  }
  const images = identity?.profileImages
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
  }
  return ''
}

const inputIconUrl = computed(() => {
  if (isLyxAsset(swap.value.input.address)) return '/lyx-icon.png'
  return tokenIconFromIdentity(inputIdentity.value)
})

const outputIconUrl = computed(() => {
  if (isLyxAsset(swap.value.output.address)) return '/lyx-icon.png'
  return tokenIconFromIdentity(outputIdentity.value)
})

// When the asset is LYX we have no contract page to link to, so we render a
// plain span. Otherwise the symbol links to the token page (matches the
// existing TransferCard convention).
const inputLinkTag = computed(() => isLyxAsset(swap.value.input.address) ? 'span' : 'a')
const outputLinkTag = computed(() => isLyxAsset(swap.value.output.address) ? 'span' : 'a')

const inputLinkAttrs = computed(() => {
  if (isLyxAsset(swap.value.input.address)) return {}
  return {
    href: `https://universaleverything.io/asset/${swap.value.input.address}`,
    target: '_blank',
    rel: 'noopener noreferrer',
  }
})

const outputLinkAttrs = computed(() => {
  if (isLyxAsset(swap.value.output.address)) return {}
  return {
    href: `https://universaleverything.io/asset/${swap.value.output.address}`,
    target: '_blank',
    rel: 'noopener noreferrer',
  }
})

const inputLinkClass = computed(() => isLyxAsset(swap.value.input.address) ? '' : 'hover:underline')
const outputLinkClass = computed(() => isLyxAsset(swap.value.output.address) ? '' : 'hover:underline')

// Queue address resolution for everything the card displays so names/icons
// appear without a manual refresh.
watchEffect(() => {
  const addrs: string[] = [actorAddress.value]
  if (hasDifferentRecipient.value) addrs.push(recipientAddress.value)
  if (!isLyxAsset(swap.value.input.address)) addrs.push(swap.value.input.address)
  if (!isLyxAsset(swap.value.output.address)) addrs.push(swap.value.output.address)
  const filtered = addrs.filter(Boolean)
  if (filtered.length) queueResolve(props.chainId, filtered)
})
</script>
