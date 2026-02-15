<template>
  <CompactCard>
    <!-- Actor -->
    <ProfileBadge
      :address="tx.from"
      :name="fromIdentity?.name"
      :profile-url="fromProfileUrl"
      size="x-small"
    />

    <!-- Action text -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
      {{ isUnfollow ? 'unfollowed' : 'followed' }}
    </span>

    <!-- Target -->
    <ProfileBadge
      :address="targetAddress"
      :name="toIdentity?.name"
      :profile-url="toProfileUrl"
      size="x-small"
    />

    <!-- Timestamp -->
    <TimeStamp class="ml-auto" :timestamp="tx.blockTimestamp" />
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

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()

const isUnfollow = computed(() => {
  const fn = props.tx.functionName?.toLowerCase() ?? ''
  return fn.includes('unfollow')
})

const targetAddress = computed(() => {
  const args = props.tx.args
  if (args) {
    const addr = args.find(a => a.type === 'address')
    if (addr && typeof addr.value === 'string') return addr.value
  }
  return props.tx.to
})

const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24) // x-small ~ 24px
})

const toIdentity = computed(() => getIdentity(targetAddress.value))
const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24) // x-small ~ 24px
})
</script>
