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
import {
  FOLLOW_EVENT, UNFOLLOW_EVENT, EXECUTED_EVENT,
  LSP26_FOLLOW_NOTIFICATION, LSP26_UNFOLLOW_NOTIFICATION,
  findLogByEvent, decodeAddressPairFromData,
  findURByTypeId, getAddressFromURReceivedData
} from '../../lib/events'
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

// Decode Follow/Unfollow event from raw logs by topic0 signature
// LSP26 emits Follow(address follower, address followed) — both non-indexed, in data
const followEventData = computed(() => {
  const logs = props.tx.logs
  // Look for Follow or Unfollow event by topic0
  const followLog = findLogByEvent(logs, FOLLOW_EVENT) || findLogByEvent(logs, UNFOLLOW_EVENT)
  if (followLog) {
    // Decoded by API?
    if (followLog.args) {
      const actor = followLog.args.find((a: any) => a.name === 'follower' || a.name === 'unfollower')
      const target = followLog.args.find((a: any) => a.name === 'followed' || a.name === 'unfollowed')
      if (actor?.value && target?.value) {
        return { actor: String(actor.value), target: String(target.value) }
      }
    }
    // Raw undecoded: both addresses in data field
    const pair = decodeAddressPairFromData(followLog.data)
    if (pair) return { actor: pair[0], target: pair[1] }
  }
  return null
})

// Actor: from Follow/Unfollow event → Executed event → UniversalReceiver receivedData → tx.from
const actorAddress = computed(() => {
  // 1. Best: Follow/Unfollow event from LSP26 (when API includes all logs)
  if (followEventData.value) return followEventData.value.actor
  // 2. Executed event emitted by the UP
  const executed = findLogByEvent(props.tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address
  // 3. UniversalReceiver with LSP26 follow/unfollow typeId — receivedData = follower UP address
  const followUR = findURByTypeId(props.tx.logs, LSP26_FOLLOW_NOTIFICATION)
    || findURByTypeId(props.tx.logs, LSP26_UNFOLLOW_NOTIFICATION)
  const urAddr = getAddressFromURReceivedData(followUR)
  if (urAddr) return urAddr
  return props.tx.from
})

// Target: from Follow/Unfollow event, then function args, then tx.to
const targetAddress = computed(() => {
  if (followEventData.value) return followEventData.value.target
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
