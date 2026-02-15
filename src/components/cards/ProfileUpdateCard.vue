<template>
  <ExtendedCard>
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
        Edited profile metadata
      </p>
      <!-- Show changed data keys if available in args -->
      <div v-if="dataKeys.length" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="key in dataKeys"
          :key="key"
          class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
        >
          {{ key }}
        </span>
      </div>
    </template>
  </ExtendedCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

const { getIdentity } = useAddressResolver()

const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24) // x-small ~ 24px
})

// Try to extract data keys from args
const dataKeys = computed(() => {
  const args = props.tx.args
  if (!args) return []
  const keys: string[] = []
  for (const arg of args) {
    if (arg.name === 'dataKey' || arg.name === 'dataKeys') {
      const val = arg.value
      if (typeof val === 'string') {
        keys.push(humanizeDataKey(val))
      } else if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string') keys.push(humanizeDataKey(v))
        }
      }
    }
  }
  return keys.slice(0, 5)
})

function humanizeDataKey(key: string): string {
  // Known ERC725Y data keys
  const knownKeys: Record<string, string> = {
    '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5': 'LSP3Profile',
    '0x0cfc51aec37c55a4d0b1a65c6255c4bf2fbdf6277f3cc0730c45b828b6db8b47': 'LSP1UniversalReceiverDelegate',
  }
  if (knownKeys[key.toLowerCase()]) return knownKeys[key.toLowerCase()]
  return key.slice(0, 10) + '...'
}
</script>
