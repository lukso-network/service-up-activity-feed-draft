<template>
  <CompactCard>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-3">
        <!-- Actor -->
        <ProfileBadge
          :address="tx.from"
          :name="fromIdentity?.name"
          :profile-url="fromProfileUrl"
          size="x-small"
        />

        <!-- Action text -->
        <span class="text-sm text-neutral-500 dark:text-neutral-400 truncate">
          Contract interaction
          <span v-if="selectorDisplay" class="font-mono text-neutral-400 dark:text-neutral-500">
            {{ selectorDisplay }}
          </span>
        </span>

        <!-- Failed badge -->
        <span
          v-if="tx.status === 0"
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0"
        >
          Failed
        </span>

        <!-- Timestamp + Expand arrow -->
        <div class="ml-auto flex items-center gap-2 flex-shrink-0">
          <TimeStamp :timestamp="tx.blockTimestamp" />
          <button
            @click.prevent="expanded = !expanded"
            class="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <svg
              class="w-4 h-4 text-neutral-400 transition-transform duration-200"
              :class="{ 'rotate-180': expanded }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Expanded raw data -->
      <TransactionExpander v-if="expanded" :tx="tx" :chain-id="chainId" />
    </div>
  </CompactCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import CompactCard from './CompactCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import TransactionExpander from '../shared/TransactionExpander.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const expanded = ref(false)

const { getIdentity } = useAddressResolver()

const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return (sorted.find(i => i.width >= 32) || sorted[0]).src
})

const selectorDisplay = computed(() => {
  if (props.tx.functionName) return props.tx.functionName
  if (props.tx.input && props.tx.input.length > 2) return props.tx.input.slice(0, 10)
  return ''
})
</script>
