<template>
  <div class="min-h-screen overflow-x-hidden">
    <!-- Refresh bar -->
    <div
      v-if="newTxCount > 0"
      class="sticky top-0 z-10 px-4 py-2 bg-lukso-pink/10 dark:bg-lukso-pink/20 backdrop-blur-sm border-b border-lukso-pink/20 cursor-pointer text-center"
      @click="showNewTransactions"
    >
      <span class="text-sm font-medium text-lukso-pink">
        {{ newTxCount }} new transaction{{ newTxCount > 1 ? 's' : '' }} — tap to show
      </span>
    </div>

    <!-- Title -->
    <div class="px-4 py-3">
      <h1 class="text-lg font-bold text-neutral-800 dark:text-neutral-200">{{ pageTitle }}</h1>
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
import { ref, computed, onMounted, onUnmounted, watch, watchEffect } from 'vue'
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
const newTxCount = ref(0)
const lastVisibleCount = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null

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
const { transactions, loading, loadingMore, error, hasMore, load, loadMore, pollNew } = useActivity(chainIdRef, addressRef, filterRef)

const visibleTransactions = computed(() => {
  if (devMode.value) return transactions.value
  return transactions.value.filter(txFilter)
})

function showNewTransactions() {
  newTxCount.value = 0
  lastVisibleCount.value = transactions.value.length
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
        if (arg.type === 'address' && typeof arg.value === 'string') {
          addresses.add(arg.value)
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

async function startPolling() {
  pollInterval = setInterval(async () => {
    const prevCount = transactions.value.length
    await pollNew()
    const newCount = transactions.value.length - prevCount
    if (newCount > 0) {
      newTxCount.value += newCount
    }
  }, 15000)
}

onMounted(async () => {
  await Promise.all([load(), loadProfile()])
  lastVisibleCount.value = transactions.value.length
  // Polling disabled for now
  // startPolling()
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

// Re-load when route changes
watch([chainIdRef, addressRef], async () => {
  if (pollInterval) clearInterval(pollInterval)
  newTxCount.value = 0
  profile.value = undefined
  await Promise.all([load(), loadProfile()])
  lastVisibleCount.value = transactions.value.length
  startPolling()
})
</script>
