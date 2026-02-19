<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 overflow-hidden max-w-full">
    <!-- Header -->
    <div class="flex gap-3 cursor-pointer" @click="toggleIfBackground($event)">
      <div class="flex items-center gap-3 min-w-0 flex-wrap flex-1">
        <ProfileBadge
          :address="tx.to"
          :name="toIdentity?.name"
          :profile-url="toProfileUrl"
          size="x-small"
        />
        <div class="basis-full h-0 sm:hidden"></div>
        <span class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ actionText }}
          <span v-if="groupCount > 1" class="text-neutral-400 dark:text-neutral-500">
            {{ groupCount }}x
          </span>
        </span>
        <span class="text-base">{{ actionIcon }}</span>
        <TimeStamp :timestamp="tx.blockTimestamp" />
      </div>
      <div class="flex-shrink-0 self-start mt-1 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all">
        <svg
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': expanded }"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>

    <!-- Expanded: tx details with pagination -->
    <div v-if="expanded">
      <!-- Pagination controls (only for groups) -->
      <div v-if="groupCount > 1" class="flex items-center gap-2 mt-3 mb-2">
        <button
          @click="currentPage = Math.max(0, currentPage - 1)"
          :disabled="currentPage === 0"
          class="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div class="flex items-center gap-1">
          <button
            v-for="(_, idx) in groupTxs"
            :key="idx"
            @click="currentPage = idx"
            class="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
            :class="currentPage === idx
              ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
          >
            {{ idx + 1 }}
          </button>
        </div>
        <button
          @click="currentPage = Math.min(groupCount - 1, currentPage + 1)"
          :disabled="currentPage === groupCount - 1"
          class="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <TxDetails :tx="(currentTx as any)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl } from '../../lib/formatters'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import TxDetails from '../shared/TxDetails.vue'

const LSP3_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5'
const LSP28_KEY = '0x724141d9918ce69e6b8afcf53a91748466086ba2c74b94cab43c649ae2ac23ff'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const expanded = ref(false)
const currentPage = ref(0)

const groupCount = computed(() => (props.tx as any)._groupCount || 1)
const groupTxs = computed<Transaction[]>(() => (props.tx as any)._groupTxs || [props.tx])
const currentTx = computed(() => groupTxs.value[currentPage.value] || props.tx)

watchEffect(() => {
  const addrs = [props.tx.from, props.tx.to].filter(Boolean)
  if (addrs.length) queueResolve(props.chainId, addrs)
})
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

function toggleIfBackground(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('a, button, lukso-username, lukso-profile, input, select')) return
  expanded.value = !expanded.value
}
</script>
