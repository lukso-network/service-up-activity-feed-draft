<template>
  <ExtendedCard :tx="(tx as any)">
    <template #header>
      <div class="flex items-center gap-3">
        <ProfileBadge
          :address="tx.from"
          :name="fromIdentity?.name"
          :profile-url="fromProfileUrl"
          size="x-small"
        />
      </div>
      <TimeStamp :timestamp="tx.blockTimestamp" format="full" />
    </template>

    <template #content>
      <p class="text-sm text-neutral-600 dark:text-neutral-300">
        Updated permissions
      </p>
      <!-- Show target address if available -->
      <div v-if="targetAddress" class="mt-2 flex items-center gap-2">
        <span class="text-xs text-neutral-400">for</span>
        <ProfileBadge
          :address="targetAddress"
          :name="targetIdentity?.name"
          :profile-url="targetProfileUrl"
          size="x-small"
        />
      </div>
    </template>
  </ExtendedCard>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl } from '../../lib/formatters'
import ExtendedCard from './ExtendedCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24) // x-small ~ 24px
})

// Extract target address for permission changes
const targetAddress = computed(() => {
  const args = props.tx.args
  if (!args) return ''
  for (const arg of args) {
    if (arg.type === 'address' && typeof arg.value === 'string') {
      return arg.value
    }
  }
  return ''
})

watchEffect(() => {
  const addrs = [props.tx.from, props.tx.to, targetAddress.value].filter(Boolean)
  if (addrs.length) queueResolve(props.chainId, addrs)
})

const targetIdentity = computed(() =>
  targetAddress.value ? getIdentity(targetAddress.value) : undefined
)
const targetProfileUrl = computed(() => {
  const images = targetIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24) // x-small ~ 24px
})
</script>
