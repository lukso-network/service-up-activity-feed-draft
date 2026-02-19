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
      <div class="flex items-center gap-2">
        <span class="text-sm text-neutral-600 dark:text-neutral-300">
          {{ actionLabel }}
        </span>
        <span
          v-if="tx.status === 0"
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        >
          Failed
        </span>
      </div>
      <div v-if="valueDisplay" class="mt-2">
        <span class="text-xs font-medium px-2 py-1 rounded-md bg-lukso-pink/10 text-lukso-pink dark:bg-lukso-pink/20">
          {{ valueDisplay }}
        </span>
      </div>
    </template>
  </ExtendedCard>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { formatFunctionName, formatLYX, optimizeImageUrl } from '../../lib/formatters'
import ExtendedCard from './ExtendedCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

// Queue address resolution
watchEffect(() => {
  const addrs = [props.tx.from, props.tx.to].filter(Boolean)
  if (addrs.length) queueResolve(props.chainId, addrs)
})
const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24) // x-small ~ 24px
})

const actionLabel = computed(() => formatFunctionName(props.tx.functionName))

const valueDisplay = computed(() => formatLYX(props.tx.value || '0'))
</script>
