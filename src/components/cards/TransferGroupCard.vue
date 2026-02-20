<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 overflow-hidden max-w-full">
    <!-- Header — clickable to expand -->
    <div class="flex gap-3 cursor-pointer" @click="toggleIfBackground($event)">
      <div class="flex items-center gap-3 min-w-0 flex-wrap flex-1">
        <!-- Same sender → multiple receivers -->
        <template v-if="groupType === 'same-sender'">
          <ProfileBadge
            :address="sharedAddress"
            :name="sharedIdentity?.name"
            :profile-url="sharedProfileUrl"
            size="x-small"
          />
          <div class="basis-full h-0 sm:hidden"></div>
          <span class="text-sm text-neutral-500 dark:text-neutral-400">
            sent {{ totalFormatted }} to {{ transactions.length }} recipients 💎
          </span>
          <div class="flex items-center -space-x-1">
            <a
              v-for="tx in previewTxs"
              :key="tx.transactionHash"
              :href="`https://universaleverything.io/${getReceiver(tx)}`"
              target="_blank"
              rel="noopener noreferrer"
              class="block"
            >
              <lukso-profile
                :profile-url="getProfileUrl(getReceiver(tx))"
                :profile-address="getReceiver(tx)"
                has-identicon
                size="x-small"
              ></lukso-profile>
            </a>
            <span v-if="transactions.length > 5" class="text-xs text-neutral-400 dark:text-neutral-500 ml-6 pl-2">
              +{{ transactions.length - 5 }}
            </span>
          </div>
        </template>

        <!-- Multiple senders → same receiver -->
        <template v-else>
          <div class="flex items-center -space-x-1">
            <a
              v-for="tx in previewTxs"
              :key="tx.transactionHash"
              :href="`https://universaleverything.io/${getSender(tx)}`"
              target="_blank"
              rel="noopener noreferrer"
              class="block"
            >
              <lukso-profile
                :profile-url="getProfileUrl(getSender(tx))"
                :profile-address="getSender(tx)"
                has-identicon
                size="x-small"
              ></lukso-profile>
            </a>
            <span v-if="transactions.length > 5" class="text-xs text-neutral-400 dark:text-neutral-500 ml-6 pl-2">
              +{{ transactions.length - 5 }}
            </span>
          </div>
          <div class="basis-full h-0 sm:hidden"></div>
          <span class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ transactions.length }} people sent {{ totalFormatted }} to 💎
          </span>
          <div class="basis-full h-0 sm:hidden"></div>
          <ProfileBadge
            :address="sharedAddress"
            :name="sharedIdentity?.name"
            :profile-url="sharedProfileUrl"
            size="x-small"
          />
        </template>

        <TimeStamp :timestamp="transactions[0].blockTimestamp" />
      </div>
      <!-- Chevron -->
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

    <!-- Expanded: individual transfer cards -->
    <div v-if="expanded" class="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800 nested-cards">
      <TransferCard
        v-for="tx in transactions"
        :key="tx.transactionHash"
        :tx="tx"
        :chain-id="chainId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl, formatLYX } from '../../lib/formatters'
import { EXECUTED_EVENT, findLogByEvent } from '../../lib/events'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import TransferCard from './TransferCard.vue'

const props = defineProps<{
  transactions: Transaction[]
  chainId: number
  groupType: 'same-sender' | 'same-receiver'
  sharedAddress: string
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const expanded = ref(false)
const previewTxs = computed(() => props.transactions.slice(0, 5))

// Total LYX across grouped transactions
const totalFormatted = computed(() => {
  let total = 0n
  for (const tx of props.transactions) {
    const rawValue = String(tx.value || '0').replace(/n$/, '')
    total += BigInt(rawValue || '0')
  }
  return formatLYX(total.toString())
})

// Queue address resolution
watchEffect(() => {
  const addrs = new Set<string>()
  if (props.sharedAddress) addrs.add(props.sharedAddress)
  for (const tx of props.transactions) {
    if (tx.from) addrs.add(tx.from)
    if (tx.to) addrs.add(tx.to)
    const toArg = tx.args?.find(a => a.name === 'to')
    if (toArg?.value && typeof toArg.value === 'string') addrs.add(toArg.value)
    const fromArg = tx.args?.find(a => a.name === 'from')
    if (fromArg?.value && typeof fromArg.value === 'string') addrs.add(fromArg.value)
  }
  if (addrs.size) queueResolve(props.chainId, [...addrs])
})

const sharedIdentity = computed(() => getIdentity(props.sharedAddress))
const sharedProfileUrl = computed(() => {
  const images = sharedIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

function getProfileUrl(address: string): string {
  const identity = getIdentity(address)
  const images = identity?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
}

function getSender(tx: Transaction): string {
  const fromArg = tx.args?.find(a => a.name === 'from')
  if (fromArg?.value && typeof fromArg.value === 'string') return fromArg.value
  const executed = findLogByEvent(tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address
  return tx.from
}

function getReceiver(tx: Transaction): string {
  const toArg = tx.args?.find(a => a.name === 'to')
  if (toArg?.value && typeof toArg.value === 'string') return toArg.value
  return tx.to || ''
}

function toggleIfBackground(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('a, button, lukso-username, lukso-profile, input, select')) return
  expanded.value = !expanded.value
}
</script>

<style scoped>
.nested-cards :deep(> *) {
  box-shadow: none !important;
  background: transparent !important;
  border-radius: 0 !important;
}
</style>
