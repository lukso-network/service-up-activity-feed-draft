<template>
  <div
    class="min-h-screen overflow-x-hidden"
    @touchstart="!address && onTouchStart($event)"
    @touchmove="!address && onTouchMove($event)"
    @touchend="!address && onTouchEnd()"
    @wheel="!address && onWheel($event)"
  >
    <!-- Pull-to-refresh indicator (main feed only, not per-profile) -->
    <div
      v-if="!address && (refreshing || refreshDone || pullDistance > 0)"
      class="flex justify-center items-center overflow-hidden"
      :style="{ height: `${(refreshing || refreshDone) ? 40 : Math.min(pullDistance, 60)}px` }"
    >
      <!-- Spinning loader -->
      <svg v-if="refreshing" class="animate-spin w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <!-- Green checkmark (shows 600ms after refresh completes) -->
      <svg
        v-else-if="refreshDone"
        class="w-6 h-6 text-neutral-400 transition-opacity duration-300"
        :class="refreshFading ? 'opacity-0' : 'opacity-100'"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <!-- Pull arrow -->
      <svg
        v-else
        class="w-5 h-5 text-neutral-400"
        :style="{ transform: `rotate(${Math.min(pullDistance / 60, 1) * 180}deg)`, opacity: Math.min(pullDistance / 20, 1) }"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </div>

    <!-- New transactions bar — hidden: count is raw (unfiltered) and misleading.
         Users can pull-to-refresh / scroll up instead. -->
    <!-- <div v-if="newTxCount > 0" ... /> -->

    <ErrorState v-if="errorMessage" :message="errorMessage" @retry="() => {}" />

    <LoadingSkeleton v-else-if="isLoading || initialLoading" />

    <TransactionList
      v-else
      :transactions="filteredTransactions"
      :chain-id="chainId"
      :profile-address="address"
      :has-more="apiHasMore"
      :loading-more="loadingMore"
      :loading="isLoading || initialLoading"
      @load-more="handleLoadMore"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, onUnmounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { ADDRESS_RESOLUTION_KEY } from '@lukso/activity-sdk/vue'
import { AddressResolutionStore } from '@lukso/activity-sdk/address-resolution'
import { useFeedApi } from '../composables/useFeedApi'
import { feedEntryToTransaction } from '../lib/feedAdapter'
import { classifyTransaction } from '../lib/formatters'
import type { Transaction } from '../lib/types'
import TransactionList from '../components/TransactionList.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import ErrorState from '../components/ErrorState.vue'

const route = useRoute()

const chainId = computed(() => parseInt(route.params.chainId as string) || 42)
const address = computed(() => ((route.params.address as string) || '').toLowerCase())

const devMode = computed(() => route.query.devmode !== undefined)

// --- Address resolution (re-uses SDK's store + provides context for card components) ---
const ADDRESS_RESOLUTION_BASE = 'https://feed.api.universalprofile.cloud'
const addressStore = new AddressResolutionStore({
  chainId: 42,
  baseUrl: ADDRESS_RESOLUTION_BASE,
})
const resolvedAddresses = ref<Record<string, any>>({})
addressStore.subscribe((resolved) => { resolvedAddresses.value = resolved })
provide(ADDRESS_RESOLUTION_KEY as any, {
  resolvedAddresses,
  requestResolution: (key: any) => addressStore.requestResolution(key),
  isResolving: (key: any) => addressStore.isResolving(key),
})
onMounted(() => { /* store starts resolving on first requestResolution call */ })
onUnmounted(() => { addressStore.destroy() })

// --- Feed API composable (replaces SDK) ---
// Pass the computed ref so it reacts to route changes
const profileIdRef = computed(() => address.value || undefined)
const {
  feedEntries,
  loading: isLoading,
  loadingMore,
  error,
  hasMore: apiHasMore,
  loadMore,
  refresh,
} = useFeedApi(profileIdRef)

const initialLoading = ref(false) // Feed API handles initial load internally

const errorMessage = computed(() => error.value?.message ?? null)

// --- Filter known card types ---
const KNOWN_TX_TYPES = new Set([
  'follow', 'unfollow',
  'token_transfer', 'nft_transfer', 'value_transfer',
  'token_mint', 'nft_mint',
  'profile_update', 'token_metadata_update',
  'permission_change',
  'create_moment',
  'contract_execution',
])

// Adapt FeedEntry[] → Transaction[] for existing card components.
// Filter uses classifyTransaction on the adapted tx so action_executed entries
// that the adapter couldn't remap to a known card type fall through as 'unknown'.
const filteredTransactions = computed(() => {
  const entries = feedEntries.value
  const adapted: Transaction[] = []
  for (const entry of entries) {
    const tx = feedEntryToTransaction(entry)
    if (!devMode.value) {
      const { type } = classifyTransaction(tx)
      if (!KNOWN_TX_TYPES.has(type)) continue
    }
    adapted.push(tx)
  }
  return adapted
})

async function handleLoadMore() {
  await loadMore()
}

// --- Page title ---
watchEffect(() => {
  if (!address.value) {
    document.title = 'UP Activity Feed'
  } else {
    const short = `${address.value.slice(0, 6)}...${address.value.slice(-4)}`
    document.title = `UP Activity Feed for ${short}`
  }
})

// --- Pull-to-refresh (touch + desktop scroll) ---
const pullDistance = ref(0)
const refreshing = ref(false)
const refreshDone = ref(false)
const refreshFading = ref(false)
let touchStartY = 0
let isPulling = false
let overscrollAccum = 0
let overscrollDecayTimer: ReturnType<typeof setTimeout> | null = null
let refreshJustFinished = false

async function doRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  pullDistance.value = 0
  overscrollAccum = 0
  await refresh()
  refreshing.value = false
  // Show green checkmark for 600ms then fade out
  refreshDone.value = true
  refreshFading.value = false
  setTimeout(() => {
    refreshFading.value = true
    setTimeout(() => {
      refreshDone.value = false
      refreshFading.value = false
    }, 300) // fade-out duration
  }, 600)
  refreshJustFinished = true
  setTimeout(() => { refreshJustFinished = false }, 1200)
}

// Touch events (mobile)
function onTouchStart(e: TouchEvent) {
  if (window.scrollY > 5) return
  touchStartY = e.touches[0].clientY
  isPulling = true
}

function onTouchMove(e: TouchEvent) {
  if (!isPulling || refreshing.value) return
  if (window.scrollY > 5) {
    isPulling = false
    pullDistance.value = 0
    return
  }
  const diff = e.touches[0].clientY - touchStartY
  if (diff > 0) {
    pullDistance.value = diff * 0.5
    if (diff > 10) e.preventDefault()
  }
}

async function onTouchEnd() {
  if (!isPulling) return
  isPulling = false
  if (pullDistance.value >= 80) {
    await doRefresh()
  } else {
    pullDistance.value = 0
  }
}

// --- Auto-poll for new entries (per-profile feeds only) ---
let _pollTimer: ReturnType<typeof setInterval> | null = null
if (address.value) {
  _pollTimer = setInterval(async () => {
    try {
      await refresh()
    } catch (e) {
      console.warn('[auto-poll] error:', e)
    }
  }, 60_000)
}

onUnmounted(() => {
  if (_pollTimer) clearInterval(_pollTimer)
})

// Wheel/scroll events (desktop)
function onWheel(e: WheelEvent) {
  if (refreshing.value || refreshJustFinished) return
  if (window.scrollY > 5) { overscrollAccum = 0; pullDistance.value = 0; return }
  if (e.deltaY >= 0) { overscrollAccum = 0; pullDistance.value = 0; return }

  overscrollAccum += Math.abs(e.deltaY)
  pullDistance.value = Math.min(overscrollAccum * 0.15, 60)

  if (pullDistance.value >= 60) {
    overscrollAccum = 0
    pullDistance.value = 0
    doRefresh()
    return
  }

  if (overscrollDecayTimer) clearTimeout(overscrollDecayTimer)
  overscrollDecayTimer = setTimeout(() => {
    const retract = () => {
      if (pullDistance.value <= 0) { overscrollAccum = 0; return }
      pullDistance.value = Math.max(0, pullDistance.value - 1.5)
      requestAnimationFrame(retract)
    }
    requestAnimationFrame(retract)
  }, 150)
}
</script>
