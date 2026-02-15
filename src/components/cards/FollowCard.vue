<template>
  <CompactCard :tx="(tx as any)">
    <!-- Actor -->
    <ProfileBadge
      :address="actorAddress"
      :name="fromIdentity?.name"
      :profile-url="fromProfileUrl"
      size="x-small"
    />

    <div class="basis-full h-0 sm:hidden"></div>

    <!-- Action text -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400">
      {{ isUnfollow ? 'unfollowed 👋' : 'followed 👤' }}
    </span>

    <div class="basis-full h-0 sm:hidden"></div>

    <!-- Target -->
    <ProfileBadge
      :address="targetAddress"
      :name="toIdentity?.name"
      :profile-url="toProfileUrl"
      size="x-small"
    />

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

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()

const isUnfollow = computed(() => {
  const fn = props.tx.functionName?.toLowerCase() ?? ''
  return fn.includes('unfollow')
})

// Actor: derive from LSP26 Follow/Unfollow event, not tx.from (could be controller key)
// LSP26 emits: Follow(address follower, address followed) / Unfollow(address unfollower, address unfollowed)
// The API may not include these events (only UP-emitted events), so fall back to Executed event address
const actorAddress = computed(() => {
  const logs = props.tx.logs
  if (logs?.length) {
    // 1. Best: Follow/Unfollow event from LSP26 — follower/unfollower arg IS the UP
    const followEvent = logs.find((l: any) => l.eventName === 'Follow' || l.eventName === 'Unfollow')
    if (followEvent?.args) {
      const actor = followEvent.args.find((a: any) => a.name === 'follower' || a.name === 'unfollower')
      if (actor?.value && typeof actor.value === 'string') return actor.value
    }
    // 2. Fallback: Executed event emitted by the UP
    const executed = logs.find((l: any) => l.eventName === 'Executed')
    if (executed?.address) return executed.address
  }
  return props.tx.from
})

// Target: derive from LSP26 Follow/Unfollow event — followed/unfollowed arg
const eventTargetAddress = computed(() => {
  const logs = props.tx.logs
  if (logs?.length) {
    const followEvent = logs.find((l: any) => l.eventName === 'Follow' || l.eventName === 'Unfollow')
    if (followEvent?.args) {
      const target = followEvent.args.find((a: any) => a.name === 'followed' || a.name === 'unfollowed')
      if (target?.value && typeof target.value === 'string') return target.value
    }
  }
  return null
})

const targetAddress = computed(() => {
  // 1. Best: from Follow/Unfollow event
  if (eventTargetAddress.value) return eventTargetAddress.value
  // 2. From function args
  const args = props.tx.args
  if (args) {
    const addr = args.find(a => a.name === 'addr')
    if (addr && typeof addr.value === 'string') return addr.value
  }
  return props.tx.to
})

const fromIdentity = computed(() => getIdentity(actorAddress.value))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

const toIdentity = computed(() => getIdentity(targetAddress.value))
const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})
</script>
