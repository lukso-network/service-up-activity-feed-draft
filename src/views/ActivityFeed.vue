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
      @load-more="handleLoadMore"
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
      // Paginate backwards until we have enough VISIBLE (post-filter) transactions.
      // Many raw txs get filtered (unknown types, aggregates, etc.), so we need
      // to keep loading until the filtered count meets our target.
      await loadUntilVisible()
    }
  } catch (e) {
    console.error('[ActivityFeed] initial fetch failed:', e)
  }
})()

// --- Map SDK DecoderResult[] → local Transaction[] (with batch splitting) ---
//
// Batch operations need splitting into individual action entries:
// - followBatch/unfollowBatch: split args.addresses into individual follow/unfollow txs
// - executeBatch: children (non-wrapper) are separate actions → promote each
// - transferBatch: handled downstream in TransactionList.vue (LIKES splitting)
// - Single operations: just show parent, skip all children (they're call-chain wrappers)
//
const BATCH_FUNCTIONS = ['followBatch', 'unfollowBatch']
const EXECUTE_BATCH_FUNCTIONS = ['executeBatch']

const mappedTransactions = computed(() => {
  const results: Transaction[] = []
  for (const dr of visibleTransactions.value) {
    const drAny = dr as any
    const fn = drAny.functionName || ''

    // 1. followBatch/unfollowBatch → split args.addresses into individual entries
    if (BATCH_FUNCTIONS.includes(fn)) {
      const addressesArg = drAny.args?.find((a: any) => a.name === 'addresses')
      if (addressesArg?.value && Array.isArray(addressesArg.value)) {
        const baseTx = mapDecoderResultToTransaction(dr)
        for (let i = 0; i < addressesArg.value.length; i++) {
          const addr = String(addressesArg.value[i])
          results.push({
            ...baseTx,
            _virtualKey: `${baseTx.transactionHash}-${fn}-${i}`,
            functionName: fn === 'unfollowBatch' ? 'unfollow' : 'follow',
            to: drAny.to, // LSP26 contract
            args: [{ name: 'addr', internalType: 'address', type: 'address', value: addr }],
          } as any)
        }
        continue
      }
    }

    // 2. executeBatch → promote non-wrapper children as separate actions
    if (EXECUTE_BATCH_FUNCTIONS.includes(fn)) {
      const children = drAny.children
      if (children && Array.isArray(children)) {
        let promoted = 0
        for (const child of children) {
          if (child.resultType === 'wrapper') continue
          if (!child.transactionHash && !child.functionName) continue
          const childTx = mapDecoderResultToTransaction(child)
          // Inherit parent block info if child is missing it
          if (!childTx.blockTimestamp) {
            childTx.blockTimestamp = drAny.blockTimestamp || 0
            childTx.blockNumber = drAny.blockNumber || '0'
            childTx.blockHash = drAny.blockHash || ''
            childTx.transactionHash = childTx.transactionHash || drAny.transactionHash || ''
          }
          results.push(childTx)
          promoted++
        }
        // If we promoted children, skip the parent batch entry
        if (promoted > 0) continue
      }
    }

    // 3. Default: show the parent transaction, skip children
    results.push(mapDecoderResultToTransaction(dr))
  }
  return results
})

// --- Filter (same logic as before) ---
// Known card types that we have dedicated UI for
const KNOWN_TX_TYPES = new Set([
  'follow', 'unfollow',
  'token_transfer', 'nft_transfer', 'value_transfer',
  'token_mint', 'nft_mint',
  'profile_update', 'token_metadata_update',
  'permission_change',
  'create_moment',
])

function txFilter(tx: Transaction): boolean {
  if (tx.status === 0) return false
  if (devMode.value) return true
  const { type } = classifyTransaction(tx)
  return KNOWN_TX_TYPES.has(type)
}

const filteredTransactions = computed(() => {
  if (devMode.value) return mappedTransactions.value
  return mappedTransactions.value.filter(txFilter)
})

// Keep loading pages until we have enough visible (filtered) transactions
const VISIBLE_TARGET = 30
async function loadUntilVisible() {
  let attempts = 0
  while (filteredTransactions.value.length < VISIBLE_TARGET && attempts < 40) {
    await loadAdditionalPages(false, true)
    attempts++
    if (!hasMoreToLoad.value) break
  }
}

// Load more when scrolling to end — keep loading until new visible items appear
let _loadMoreRunning = false
async function handleLoadMore() {
  if (_loadMoreRunning) return
  _loadMoreRunning = true
  try {
    const before = filteredTransactions.value.length
    let attempts = 0
    // Load pages until at least 5 new visible items appear or no more data
    while (filteredTransactions.value.length - before < 5 && attempts < 10) {
      await loadAdditionalPages(false, true)
      attempts++
      if (!hasMoreToLoad.value) break
    }
  } finally {
    _loadMoreRunning = false
  }
}

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
