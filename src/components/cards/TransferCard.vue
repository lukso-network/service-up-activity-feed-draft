<template>
  <CompactCard>
    <!-- Actor (sender) -->
    <ProfileBadge
      :address="tx.from"
      :name="fromIdentity?.name"
      :profile-url="fromProfileUrl"
      size="x-small"
    />

    <!-- Action text -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400 whitespace-nowrap flex items-center gap-1">
      <template v-if="transferType === 'lyx'">
        Sent <span class="font-medium text-neutral-800 dark:text-neutral-200">{{ formattedAmount }}</span> to
      </template>
      <template v-else-if="transferType === 'lsp7'">
        Sent <span class="font-medium text-neutral-800 dark:text-neutral-200">{{ tokenAmount }} {{ tokenName }}</span> to
      </template>
      <template v-else>
        Sent <span class="font-medium text-neutral-800 dark:text-neutral-200">{{ tokenName }} #{{ tokenId }}</span> to
      </template>
    </span>

    <!-- Target (receiver) -->
    <ProfileBadge
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
    const whole = val / 10n ** 18n
    const frac = val % 10n ** 18n
    if (frac === 0n) return whole.toString()
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '').slice(0, 4)
    return `${whole}.${fracStr}`
  }
  return ''
})

const tokenName = computed(() => {
  // Use toName from enhanced decoding if available
  if (props.tx.toName && transferType.value !== 'lyx') return props.tx.toName
  return transferType.value === 'lsp8' ? 'NFT' : 'Token'
})

const tokenId = computed(() => {
  const args = props.tx.args
  if (!args) return ''
  const id = args.find(a => a.name === 'tokenId')
  if (id) return String(id.value).slice(0, 10)
  return ''
})
</script>
