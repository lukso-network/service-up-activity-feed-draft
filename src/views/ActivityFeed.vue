<template>
  <div
    class="min-h-screen overflow-x-hidden"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @wheel="onWheel"
  >
    <!-- Pull-to-refresh indicator -->
    <div
      v-if="refreshing || pullDistance > 0"
      class="flex justify-center items-center overflow-hidden"
      :style="{ height: `${refreshing ? 40 : Math.min(pullDistance, 60)}px` }"
    >
      <svg v-if="refreshing" class="animate-spin w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <svg
        v-else
        class="w-5 h-5 text-neutral-400"
        :style="{ transform: `rotate(${Math.min(pullDistance / 60, 1) * 180}deg)`, opacity: Math.min(pullDistance / 20, 1) }"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </div>

    <!-- New transactions bar -->
    <div
      v-if="newTxCount > 0"
      class="sticky top-0 z-10 px-4 py-2 bg-sky-500/10 dark:bg-sky-400/15 backdrop-blur-sm border-b border-sky-500/20 cursor-pointer text-center"
      @click="showNewTransactions"
    >
      <span class="text-sm font-medium text-sky-600 dark:text-sky-400">
        {{ newTxCount }} new transaction{{ newTxCount > 1 ? 's' : '' }} — tap to show
      </span>
    </div>

    <ErrorState v-if="errorMessage" :message="errorMessage" @retry="() => {}" />

    <LoadingSkeleton v-else-if="isLoading" />

    <TransactionList
      v-else
      :transactions="filteredTransactions"
      :chain-id="chainId"
      :profile-address="address"
      :has-more="hasMoreToLoad"
      :loading-more="loadingMore"
      :loading="isLoading"
      @load-more="loadMoreTransactions"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useTransactionList } from '@lukso/activity-sdk/vue'
import type { Transaction } from '../lib/types'
import { classifyTransaction } from '../lib/formatters'
import { mapDecoderResultToTransaction } from '../lib/mapDecoderResult'
import TransactionList from '../components/TransactionList.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import ErrorState from '../components/ErrorState.vue'

const SDK_BASE_URL = ''

const route = useRoute()

const chainId = computed(() => parseInt(route.params.chainId as string) || 42)
const address = computed(() => ((route.params.address as string) || '').toLowerCase())

const devMode = computed(() => route.query.devmode !== undefined)

// --- SDK composable ---
const {
  visibleTransactions,
  isLoading,
  error,
  hasMoreToLoad,
  loadingMore,
  newTransactionCount,
  loadMoreTransactions,
  loadQueuedTransactions,
  loadAdditionalPages,
  initializeData,
} = useTransactionList({
  chainId: chainId.value,
  address: address.value || undefined,
  baseUrl: SDK_BASE_URL,
})

const newTxCount = computed(() => newTransactionCount.value)
const errorMessage = computed(() => error.value?.message ?? null)

// Bootstrap: fetch initial page from API (no fromBlock/toBlock) to seed the SDK,
// then let loadAdditionalPages paginate backwards until we have ~50 transactions.
// The SDK's startPolling sends fromBlock=currentBlock which only gets the latest block.
// We need a clean first request to get archive_height + next_block for pagination.
;(async () => {
  try {
    const body: Record<string, any> = { chainId: chainId.value }
    if (address.value) body.address = address.value
    const res = await fetch(`${SDK_BASE_URL}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const initialData = await res.json()
    if (initialData.success) {
      await initializeData(initialData)
      // Now paginate backwards until we have 50 transactions
      const TARGET = 50
      let attempts = 0
      while (visibleTransactions.value.length < TARGET && attempts < 20) {
        await loadAdditionalPages(false, true)
        attempts++
        if (!hasMoreToLoad.value) break
      }
    }
  } catch (e) {
    console.error('[ActivityFeed] initial fetch failed:', e)
  }
})()

// --- Map SDK DecoderResult[] → local Transaction[] (with batch child flattening) ---
const mappedTransactions = computed(() => {
  const results: Transaction[] = []
  for (const dr of visibleTransactions.value) {
    const tx = mapDecoderResultToTransaction(dr)
    results.push(tx)
    // Flatten batch children into the main list
    const drAny = dr as any
    if (drAny.children && Array.isArray(drAny.children)) {
      for (const child of drAny.children) {
        results.push(mapDecoderResultToTransaction(child))
      }
    }
  }
  return results
})

// --- Filter (same logic as before) ---
function txFilter(tx: Transaction): boolean {
  if (tx.status === 0) return false
  const { type } = classifyTransaction(tx)
  if (type === 'contract_execution' || type === 'unknown') return false
  return true
}

const filteredTransactions = computed(() => {
  if (devMode.value) return mappedTransactions.value
  return mappedTransactions.value.filter(txFilter)
})

// --- New transactions bar ---
function showNewTransactions() {
  loadQueuedTransactions()
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
  // Merge any queued transactions from polling
  loadQueuedTransactions()
  refreshing.value = false
  refreshJustFinished = true
  setTimeout(() => { refreshJustFinished = false }, 1000)
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
