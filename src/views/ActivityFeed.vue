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

    <!-- New activity found while scrolled down. Counts the entries that will
         actually render (same filter as the list), so it never over-promises. -->
    <div class="fixed top-3 inset-x-0 z-20 flex justify-center pointer-events-none" aria-live="polite">
      <Transition name="new-pill">
        <button
          v-if="pendingCount > 0"
          type="button"
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-lukso-pink px-3.5 py-1.5 text-xs font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-lukso-magenta focus:outline-none focus-visible:ring-2 focus-visible:ring-lukso-pink focus-visible:ring-offset-2"
          @click="showPending"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
          </svg>
          {{ pendingLabel }}
        </button>
      </Transition>
    </div>

    <ErrorState v-if="errorMessage && !feedEntries.length" :message="errorMessage" @retry="reload" />

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
import { ref, computed, watch, watchEffect, onMounted, onUnmounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { ADDRESS_RESOLUTION_KEY } from '../lib/addressResolutionContext'
import { AddressResolutionStore } from '@lukso/activity-sdk/address-resolution'
import { useFeedApi } from '../composables/useFeedApi'
import { DEFAULT_CHAIN_ID, normalizeChainId } from '../lib/chains'
import { FEED_PAGE_SIZE } from '../lib/feedQuery'
import { feedEntriesToTransactions } from '../lib/feedPipeline'
import TransactionList from '../components/TransactionList.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import ErrorState from '../components/ErrorState.vue'

const route = useRoute()

const chainId = computed(() => normalizeChainId(parseInt(route.params.chainId as string) || DEFAULT_CHAIN_ID))
const address = computed(() => ((route.params.address as string) || '').toLowerCase())

const devMode = computed(() => route.query.devmode !== undefined)

// --- Feed API composable (replaces SDK) ---
// Pass the computed refs so the feed reacts to route changes — including the chain,
// which selects the mainnet vs testnet indexer endpoint.
const profileIdRef = computed(() => address.value || undefined)
const {
  feedEntries,
  loading: isLoading,
  loadingMore,
  error,
  hasMore: apiHasMore,
  loadMore,
  poll,
  refresh,
  pending,
  applyPending,
  reload,
  enrichedIdentities,
} = useFeedApi(profileIdRef, FEED_PAGE_SIZE, chainId)

// --- Address resolution (re-uses SDK's store + provides context for card components) ---
// Enriched identities from the feed query are merged with the store's resolved addresses,
// giving cards immediate access to profile names, token icons, etc. without waiting
// for separate resolution API calls.
const ADDRESS_RESOLUTION_BASE = 'https://feed.api.universalprofile.cloud'
const storeAddresses = ref<Record<string, any>>({})
let addressStore: AddressResolutionStore | undefined
let unsubscribeAddressStore: (() => void) | undefined

function resetAddressStore(nextChainId: number) {
  unsubscribeAddressStore?.()
  addressStore?.destroy()
  storeAddresses.value = {}

  addressStore = new AddressResolutionStore({
    chainId: nextChainId,
    baseUrl: ADDRESS_RESOLUTION_BASE,
  })
  unsubscribeAddressStore = addressStore.subscribe((resolved) => {
    storeAddresses.value = resolved
  })
}

watch(chainId, resetAddressStore, { immediate: true })

// Merge enriched data (pre-loaded from feed query) with store-resolved addresses.
// Store data takes precedence as it may be more complete.
const resolvedAddresses = computed(() => ({
  ...enrichedIdentities.value,
  ...storeAddresses.value,
}))

provide(ADDRESS_RESOLUTION_KEY, {
  resolvedAddresses,
  requestResolution: (key) => addressStore?.requestResolution(key),
  isResolving: (key) => addressStore?.isResolving(key) ?? false,
})
onMounted(() => { /* store starts resolving on first requestResolution call */ })
onUnmounted(() => {
  unsubscribeAddressStore?.()
  addressStore?.destroy()
})

const initialLoading = ref(false) // Feed API handles initial load internally

const errorMessage = computed(() => error.value?.message ?? null)

// Adapt FeedEntry[] → Transaction[] for the card components (see feedPipeline).
const filteredTransactions = computed(() => feedEntriesToTransactions(feedEntries.value, devMode.value))

// --- Live updates ---
// New entries are staged by the poller. At the top of the feed they are shown
// straight away (they animate in); further down a pill offers them, so content
// never shifts under the reader.
const pendingCount = computed(() => {
  const update = pending.value
  return update ? feedEntriesToTransactions(update.entries, devMode.value).length : 0
})
const pendingLabel = computed(() => {
  const more = pending.value?.replace ? '+' : ''
  return `${pendingCount.value}${more} new`
})

const NEAR_TOP_PX = 24

function isNearTop(): boolean {
  return window.scrollY <= NEAR_TOP_PX
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function maybeShowPending() {
  const update = pending.value
  if (!update) return
  if (pendingCount.value === 0) {
    // Additions that would all be filtered out change nothing visible. A
    // replacement made only of hidden rows would empty the list, so it waits
    // until it holds something to show.
    if (!update.replace) applyPending({ trim: isNearTop() })
    return
  }
  if (isNearTop()) applyPending({ trim: true })
  // Otherwise the pill offers it.
}

watch(pending, maybeShowPending)

function showPending() {
  applyPending({ trim: true })
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

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
  // Same rules as live updates: shown here at the top, offered by the pill if
  // the reader scrolled away meanwhile.
  maybeShowPending()
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

// --- Auto-poll for new entries ---
// The global feed asks only for new blocks, so it can poll often; a profile
// feed re-reads its newest page, so it polls less. Polling pauses while the
// page is hidden and catches up as soon as it is visible again.
const GLOBAL_POLL_INTERVAL_MS = 15_000
const PROFILE_POLL_INTERVAL_MS = 60_000
// The first page comes from the indexer's shared response cache and can be a
// few minutes old, so the first poll follows shortly after it is on screen.
const FIRST_POLL_DELAY_MS = 3_000
const pollIntervalMs = computed(() => (address.value ? PROFILE_POLL_INTERVAL_MS : GLOBAL_POLL_INTERVAL_MS))

let pollTimer: ReturnType<typeof setTimeout> | null = null
let lastPollAt = Date.now()
// Route changes between route records (e.g. `/` → `/42/0x…`) remount this view;
// a poll still in flight must not re-arm the timer of the unmounted instance.
let unmounted = false

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}

function schedulePoll(delayMs = pollIntervalMs.value) {
  stopPolling()
  if (unmounted || document.hidden) return
  pollTimer = setTimeout(async () => {
    pollTimer = null
    lastPollAt = Date.now()
    await poll()
    if (unmounted) return
    // Also covers a viewer who scrolled back to the top since the last update.
    maybeShowPending()
    if (!pollTimer) schedulePoll()
  }, delayMs)
}

function onVisibilityChange() {
  if (document.hidden) {
    stopPolling()
    return
  }
  const overdueMs = pollIntervalMs.value - (Date.now() - lastPollAt)
  schedulePoll(Math.max(0, overdueMs))
}

watch([address, chainId], () => {
  lastPollAt = Date.now()
  schedulePoll(FIRST_POLL_DELAY_MS)
}, { immediate: true })

watch(isLoading, (loadingNow, loadingBefore) => {
  if (loadingBefore && !loadingNow) schedulePoll(FIRST_POLL_DELAY_MS)
})

onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
onUnmounted(() => {
  unmounted = true
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
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

<style scoped>
.new-pill-enter-active,
.new-pill-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.new-pill-enter-from,
.new-pill-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .new-pill-enter-from,
  .new-pill-leave-to {
    transform: none;
  }
}
</style>
