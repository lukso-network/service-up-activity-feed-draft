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

    <ErrorState v-if="error" :message="error" @retry="load" />

    <LoadingSkeleton v-else-if="loading" />

    <TransactionList
      v-else
      :transactions="visibleTransactions"
      :chain-id="chainId"
      :profile-address="address"
      :has-more="hasMore"
      :loading-more="loadingMore"
      :loading="loading"
      @load-more="loadMore"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useActivity } from '../composables/useActivity'
import { useAddressResolver } from '../composables/useAddressResolver'
import type { AddressIdentity, Transaction } from '../lib/types'
import { resolveAddresses } from '../lib/api'
import { classifyTransaction } from '../lib/formatters'
import TransactionList from '../components/TransactionList.vue'
import LoadingSkeleton from '../components/LoadingSkeleton.vue'
import ErrorState from '../components/ErrorState.vue'

const route = useRoute()

const chainId = computed(() => parseInt(route.params.chainId as string) || 42)
const address = computed(() => ((route.params.address as string) || '').toLowerCase())

const chainIdRef = computed(() => chainId.value)
const addressRef = computed(() => address.value)

const { queueResolve } = useAddressResolver()

const profile = ref<AddressIdentity>()
const profileLoading = ref(true)
const lastVisibleCount = ref(0)

const devMode = computed(() => route.query.devmode !== undefined)

// Title: "UP Activity Feed" or "UP Activity Feed for @user#1234"
const pageTitle = computed(() => {
  if (!address.value) return 'UP Activity Feed'
  const name = profile.value?.name
  const hash = address.value.slice(2, 6).toUpperCase()
  if (name) return `UP Activity Feed for @${name}#${hash}`
  return `UP Activity Feed for ${address.value.slice(0, 6)}...${address.value.slice(-4)}`
})

watchEffect(() => {
  document.title = pageTitle.value
})

function txFilter(tx: Transaction): boolean {
  if (tx.status === 0) return false
  const { type } = classifyTransaction(tx)
  if (type === 'contract_execution' || type === 'unknown') return false
  return true
}

// Pass filter to useActivity so it auto-fetches until enough visible txs
const filterRef = computed(() => devMode.value ? null : txFilter)
const { transactions, loading, loadingMore, error, hasMore, newTxCount, load, loadMore, showNew, pollNow } = useActivity(chainIdRef, addressRef, filterRef)

const visibleTransactions = computed(() => {
  if (devMode.value) return transactions.value
  return transactions.value.filter(txFilter)
})

function showNewTransactions() {
  showNew()
  lastVisibleCount.value = transactions.value.length
}

// Pull-to-refresh (touch + desktop scroll)
const pullDistance = ref(0)
const refreshing = ref(false)
let touchStartY = 0
let isPulling = false
let overscrollAccum = 0
let overscrollDecayTimer: ReturnType<typeof setTimeout> | null = null
let refreshJustFinished = false

async function doRefresh() {
  if (refreshing.value) return // prevent double-trigger
  refreshing.value = true
  pullDistance.value = 0
  overscrollAccum = 0
  // Merge queued + fetch new (does NOT replace the list)
  await pollNow()
  lastVisibleCount.value = transactions.value.length
  refreshing.value = false
  // Block new pull attempts briefly so residual wheel events don't re-show the arrow
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

  // When user stops scrolling, rotate arrow back down then fade out
  if (overscrollDecayTimer) clearTimeout(overscrollDecayTimer)
  overscrollDecayTimer = setTimeout(() => {
    // Animate back: quickly reduce pullDistance to 0
    const retract = () => {
      if (pullDistance.value <= 0) { overscrollAccum = 0; return }
      pullDistance.value = Math.max(0, pullDistance.value - 1.5)
      requestAnimationFrame(retract)
    }
    requestAnimationFrame(retract)
  }, 150)
}

async function loadProfile() {
  if (!address.value) return
  profileLoading.value = true
  try {
    const res = await resolveAddresses(chainId.value, [address.value])
    const identity = res.addressIdentities[address.value.toLowerCase()]
    if (identity) {
      profile.value = identity
    }
  } catch {
    // Profile header is optional
  } finally {
    profileLoading.value = false
  }
}

// Resolve addresses for visible transactions
watch(transactions, (txs) => {
  const addresses = new Set<string>()
  for (const tx of txs) {
    if (tx.from) addresses.add(tx.from)
    if (tx.to) addresses.add(tx.to)
    // Addresses from args
    if (tx.args) {
      for (const arg of tx.args) {
        if (typeof arg.value === 'string' && (arg.type === 'address' || arg.internalType === 'address')) {
          addresses.add(arg.value)
        } else if (Array.isArray(arg.value) && (arg.type === 'address[]' || arg.internalType === 'address[]')) {
          for (const v of arg.value) {
            if (typeof v === 'string') addresses.add(v)
          }
        }
      }
    }
    // Collect addresses from event logs (Transfer emitter = token contract, etc.)
    if (tx.logs) {
      for (const log of tx.logs as any[]) {
        if (log.address) addresses.add(log.address)
        if (log.args) {
          for (const arg of log.args) {
            if (arg.type === 'address' && typeof arg.value === 'string' && arg.value !== '0x0000000000000000000000000000000000000000') {
              addresses.add(arg.value)
            }
          }
        }
      }
    }
  }
  if (addresses.size > 0) {
    queueResolve(chainId.value, [...addresses])
  }
}, { immediate: true })

onMounted(async () => {
  await Promise.all([load(), loadProfile()])
  lastVisibleCount.value = transactions.value.length
})

// Re-load when route changes
watch([chainIdRef, addressRef], async () => {
  profile.value = undefined
  await Promise.all([load(), loadProfile()])
  lastVisibleCount.value = transactions.value.length
})
</script>
