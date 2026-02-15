<template>
  <CompactCard :tx="(tx as any)">
    <!-- Actor -->
    <ProfileBadge
      :address="tx.from"
      :name="fromIdentity?.name"
      :profile-url="fromProfileUrl"
      size="x-small"
    />

    <div class="basis-full h-0 sm:hidden"></div>

    <!-- Action text -->
    <span class="text-sm text-neutral-500 dark:text-neutral-400 truncate">
      Contract interaction
      <span v-if="selectorDisplay" class="font-mono text-neutral-400 dark:text-neutral-500">
        {{ selectorDisplay }}
      </span>
    </span>

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

const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

const selectorDisplay = computed(() => {
  if (props.tx.functionName) return props.tx.functionName
  if (props.tx.input && props.tx.input.length > 2) return props.tx.input.slice(0, 10)
  return ''
})
</script>
