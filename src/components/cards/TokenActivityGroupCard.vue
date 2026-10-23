<template>
  <div class="bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(255,255,255,0.06)] p-4 overflow-hidden max-w-full">
    <!-- Header — clickable to expand -->
    <div class="flex gap-2 cursor-pointer" @click="toggleIfBackground($event)">
      <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1">
        <ProfileBadge
          :address="signature.actor"
          :name="actorIdentity?.name"
          :profile-url="actorProfileUrl"
          :is-e-o-a="actorIsEOA"
          :is-bot="actorIsBot"
          size="x-small"
        />
        <div class="basis-full h-0 sm:hidden"></div>
        <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
          {{ verb }}
          <a
            :href="`https://universaleverything.io/asset/${signature.contract}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
          >
            <span v-if="totalAmount">{{ totalAmount }}</span>
            <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
            <span>{{ tokenDisplayName }}</span>
          </a>
          <template v-if="isTransfer">to</template>
          <template v-else-if="isBurn">🔥</template>
        </span>
        <ProfileBadge
          v-if="isTransfer"
          :address="signature.counterparty"
          :name="receiverIdentity?.name"
          :profile-url="receiverProfileUrl"
          :is-e-o-a="receiverIsEOA"
          :is-bot="receiverIsBot"
          size="x-small"
        />
        <span
          v-if="showCount"
          class="text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 rounded-full px-2 py-0.5"
        >
          {{ transactions.length }}×
        </span>
        <TimeStamp :timestamp="transactions[0].blockTimestamp" />
      </div>
      <!-- Chevron -->
      <div class="flex-shrink-0 self-start mt-1 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all">
        <svg
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': expanded }"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>

    <!-- Expanded: individual transfer cards -->
    <div v-if="expanded" class="mt-3 divide-y divide-neutral-100 dark:divide-neutral-850 border-t border-neutral-100 dark:border-neutral-850 nested-cards">
      <TransferCard
        v-for="(tx, index) in transactions"
        :key="`${(tx as any)._virtualKey || tx.transactionHash}-${index}`"
        :tx="tx"
        :chain-id="chainId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import type { TokenActivitySignature } from '../../lib/tokenActivityGroup'
import { getRawTokenAmount } from '../../lib/tokenActivityGroup'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { formatWhole, optimizeImageUrl } from '../../lib/formatters'
import { isEOA as checkIsEOA, isBot as checkIsBot } from '../../lib/eoa'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import TransferCard from './TransferCard.vue'

const props = defineProps<{
  transactions: Transaction[]
  chainId: number
  signature: TokenActivitySignature
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const expanded = ref(false)

const isNft = computed(() => props.signature.type.startsWith('nft_'))
const isTransfer = computed(() => props.signature.type.endsWith('_transfer'))
const isBurn = computed(() => props.signature.type.endsWith('_burn'))

const verb = computed(() => {
  if (isTransfer.value) return 'sent'
  if (isBurn.value) return 'burned'
  return 'minted'
})

// ─── Actor / receiver ───
const actorIdentity = computed(() => getIdentity(props.signature.actor))
const actorIsEOA = computed(() => checkIsEOA(actorIdentity.value))
const actorIsBot = computed(() => checkIsBot(actorIdentity.value))
const actorProfileUrl = computed(() => getProfileUrl(actorIdentity.value?.profileImages))

const receiverIdentity = computed(() => getIdentity(props.signature.counterparty))
const receiverIsEOA = computed(() => checkIsEOA(receiverIdentity.value))
const receiverIsBot = computed(() => checkIsBot(receiverIdentity.value))
const receiverProfileUrl = computed(() => getProfileUrl(receiverIdentity.value?.profileImages))

function getProfileUrl(images: Array<{ src: string; width: number }> | undefined): string {
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
}

// ─── Token display ───
const tokenIdentity = computed(() => getIdentity(props.signature.contract))

const tokenDisplayName = computed(() => {
  const identity = tokenIdentity.value
  const first = props.transactions[0]
  return identity?.lsp4TokenSymbol || identity?.lsp4TokenName || identity?.name ||
    first?.feedTokenSymbol || first?.feedTokenName ||
    (isNft.value ? 'NFT' : 'Token')
})

const tokenIconUrl = computed(() => {
  const identity = tokenIdentity.value
  const images = identity?.icons?.length ? identity.icons : identity?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
})

// ─── Amount: NFTs count items, LSP7 tokens sum the raw amounts ───
const totalAmount = computed(() => {
  if (isNft.value) return formatWhole(BigInt(props.transactions.length))
  let total = 0n
  for (const tx of props.transactions) {
    const amount = getRawTokenAmount(tx, props.signature.type)
    if (amount == null) return ''
    total += amount
  }
  const decimals = tokenIdentity.value?.decimals ?? props.transactions[0]?.feedTokenDecimals ?? 18
  return formatTokenAmount(total, decimals)
})

// The NFT amount already is the item count — only LSP7 groups need the extra counter
const showCount = computed(() => !isNft.value)

function formatTokenAmount(value: bigint, decimals: number): string {
  const dec = BigInt(decimals)
  if (dec === 0n) {
    const s = value.toString()
    if (s.length > 12) return `${s[0]}.${s.slice(1, 4)}e${s.length - 1}`
    return Number(value).toLocaleString('en-US')
  }
  const divisor = 10n ** dec
  const whole = value / divisor
  const frac = value % divisor
  if (frac === 0n) return formatWhole(whole)
  const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 4)
  return `${formatWhole(whole)}.${fracStr}`
}

// Queue address resolution
watchEffect(() => {
  const { actor, counterparty, contract } = props.signature
  queueResolve(props.chainId, [...new Set([actor, counterparty, contract].filter(Boolean))])
})

function toggleIfBackground(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('a, button, lukso-username, lukso-profile, input, select')) return
  expanded.value = !expanded.value
}
</script>

<style scoped>
.nested-cards :deep(> *) {
  box-shadow: none !important;
  background: transparent !important;
  border-radius: 0 !important;
  border: none !important;
}
</style>
