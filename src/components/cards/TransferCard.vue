<template>
  <CompactCard>
    <!-- Actor (sender) -->
    <template v-if="senderIsAsset">
      <a
        :href="`https://universaleverything.io/asset/${tx.from}`"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
      >
        <img v-if="senderIconUrl" :src="senderIconUrl" class="w-6 h-6 rounded-full" :alt="senderAssetName" />
        <span class="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{{ senderAssetName }}</span>
      </a>
    </template>
    <ProfileBadge
      v-else
      :address="tx.from"
      :name="fromIdentity?.name"
      :profile-url="fromProfileUrl"
      size="x-small"
    />

    <!-- Action text -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400 whitespace-nowrap flex items-center gap-1">
      <template v-if="transferType === 'lyx'">
        Sent <span class="font-medium text-neutral-800 dark:text-neutral-200">{{ formattedAmount }} LYX</span> to
      </template>
      <template v-else-if="transferType === 'lsp7'">
        Sent
        <a
          :href="`https://universaleverything.io/asset/${tx.to}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <span>{{ tokenAmount }}</span>
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
          <span>{{ tokenDisplayName }}</span>
        </a> to
      </template>
      <template v-else>
        Sent
        <a
          :href="`https://universaleverything.io/asset/${tx.to}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
          <span>{{ tokenDisplayName }}</span>
        </a> to
      </template>
    </span>

    <!-- Target (receiver) -->
    <template v-if="receiverIsAsset">
      <a
        :href="`https://universaleverything.io/asset/${receiver}`"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
      >
        <img v-if="receiverIconUrl" :src="receiverIconUrl" class="w-6 h-6 rounded-full" :alt="receiverAssetName" />
        <span class="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{{ receiverAssetName }}</span>
      </a>
    </template>
    <ProfileBadge
      v-else
      :address="receiver"
      :name="toIdentity?.name"
      :profile-url="toProfileUrl"
      size="x-small"
    />

    <!-- Timestamp (right side) -->
    <TimeStamp class="ml-auto" :timestamp="tx.blockTimestamp" />
  </CompactCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { formatLYX } from '../../lib/formatters'
import CompactCard from './CompactCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()

const fromIdentity = computed(() => getIdentity(props.tx.from))

const senderIsAsset = computed(() => {
  const identity = fromIdentity.value
  if (!identity) return false
  return identity.isLSP7 === true ||
    identity.__gqltype === 'Asset' ||
    identity.standard?.includes('LSP7') ||
    identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const senderAssetName = computed(() => {
  const identity = fromIdentity.value
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.name) return identity.name
  return 'Token'
})

const senderIconUrl = computed(() => {
  const identity = fromIdentity.value
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return (sorted.find(i => i.width >= 32) || sorted[0]).src
  }
  return ''
})

const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return (sorted.find(i => i.width >= 32) || sorted[0]).src
})

// Determine transfer type
const transferType = computed(() => {
  const standard = props.tx.standard?.toLowerCase() ?? ''
  if (standard.includes('lsp8') || standard.includes('identifiabledigitalasset')) return 'lsp8'
  if (standard.includes('lsp7') || standard.includes('digitalasset')) return 'lsp7'
  return 'lyx'
})

// Extract receiver address from args or fallback to tx.to
const receiver = computed(() => {
  const args = props.tx.args
  if (args) {
    const to = args.find(a => a.name === 'to')
    if (to && typeof to.value === 'string') return to.value
  }
  return props.tx.to
})

const toIdentity = computed(() => getIdentity(receiver.value))

// Check if receiver is an asset (LSP7/LSP8) rather than a profile
const receiverIsAsset = computed(() => {
  const identity = toIdentity.value
  if (!identity) return false
  return identity.isLSP7 === true ||
    identity.__gqltype === 'Asset' ||
    identity.standard?.includes('LSP7') ||
    identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const receiverAssetName = computed(() => {
  const identity = toIdentity.value
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.name) return identity.name
  return 'Token'
})

const receiverIconUrl = computed(() => {
  const identity = toIdentity.value
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return (sorted.find(i => i.width >= 32) || sorted[0]).src
  }
  return ''
})

const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return (sorted.find(i => i.width >= 32) || sorted[0]).src
})

// Format amounts
const formattedAmount = computed(() => {
  if (transferType.value === 'lyx') {
    return formatLYX(props.tx.value || '0')
  }
  return ''
})

const tokenAmount = computed(() => {
  const args = props.tx.args
  if (!args) return ''
  const amount = args.find(a => a.name === 'amount')
  if (amount) {
    const val = BigInt(String(amount.value))
    const dec = BigInt(tokenDecimals.value)
    if (dec === 0n) return val.toString()
    const divisor = 10n ** dec
    const whole = val / divisor
    const frac = val % divisor
    if (frac === 0n) return whole.toString()
    const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 4)
    return `${whole}.${fracStr}`
  }
  return ''
})

// Token contract identity (tx.to is the token contract for LSP7/LSP8)
const tokenContractIdentity = computed(() => {
  if (transferType.value === 'lyx') return undefined
  return getIdentity(props.tx.to)
})

const tokenDecimals = computed(() => {
  return tokenContractIdentity.value?.decimals ?? 18
})

const tokenName = computed(() => {
  const identity = tokenContractIdentity.value
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.name) return identity.name
  if (props.tx.toName && transferType.value !== 'lyx') return props.tx.toName
  return transferType.value === 'lsp8' ? 'NFT' : 'Token'
})

// Display name: prefer full token name for readability, fall back to symbol
const tokenDisplayName = computed(() => {
  const identity = tokenContractIdentity.value
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.name) return identity.name
  if (props.tx.toName && transferType.value !== 'lyx') return props.tx.toName
  return transferType.value === 'lsp8' ? 'NFT' : 'Token'
})

const tokenIconUrl = computed(() => {
  const identity = tokenContractIdentity.value
  // Token assets use 'icons' not 'profileImages'
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return (sorted.find(i => i.width >= 32) || sorted[0]).src
  }
  // Fallback to profileImages
  const images = identity?.profileImages
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    return (sorted.find(i => i.width >= 32) || sorted[0]).src
  }
  return ''
})

const tokenId = computed(() => {
  const args = props.tx.args
  if (!args) return ''
  const id = args.find(a => a.name === 'tokenId')
  if (id) return String(id.value).slice(0, 10)
  return ''
})
</script>
