<template>
  <CompactCard :tx="(tx as any)">
    <!-- Actor -->
    <ProfileBadge
      :address="tx.to"
      :name="toIdentity?.name"
      :profile-url="toProfileUrl"
      size="x-small"
    />

    <!-- Action text -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400 ">
      {{ actionText }}
    </span>

    <!-- Icon -->
    <span class="text-base">{{ actionIcon }}</span>

    <!-- Timestamp -->
    <TimeStamp :timestamp="tx.blockTimestamp" />
  </CompactCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl } from '../../lib/formatters'
import CompactCard from './CompactCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const LSP3_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5'
const LSP28_KEY = '0x724141d9918ce69e6b8afcf53a91748466086ba2c74b94cab43c649ae2ac23ff'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()

const toIdentity = computed(() => getIdentity(props.tx.to))
const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

const updateType = computed(() => {
  const args = props.tx.args
  if (!args) return 'unknown'
  
  for (const arg of args) {
    if (arg.name === 'dataKey' || arg.name === 'dataKeys') {
      const val = arg.value
      const keys = typeof val === 'string' ? [val] : Array.isArray(val) ? val : []
      for (const key of keys) {
        const k = String(key).toLowerCase()
        if (k === LSP28_KEY.toLowerCase()) return 'grid'
        if (k === LSP3_KEY.toLowerCase()) return 'profile'
      }
    }
  }
  return 'unknown'
})

const actionText = computed(() => {
  switch (updateType.value) {
    case 'grid': return 'edited their grid'
    case 'profile': return 'edited their profile'
    default: return 'updated profile data'
  }
})

const actionIcon = computed(() => {
  switch (updateType.value) {
    case 'grid': return '🧩'
    case 'profile': return '✨'
    default: return '✏️'
  }
})
</script>
