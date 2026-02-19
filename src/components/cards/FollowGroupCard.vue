<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 overflow-hidden max-w-full">
    <!-- Header — clickable to expand -->
    <div class="flex gap-3 cursor-pointer" @click="toggleIfBackground($event)">
      <div class="flex items-center gap-3 min-w-0 flex-wrap flex-1">
        <!-- Same actor → multiple targets -->
        <template v-if="groupType === 'same-actor'">
          <ProfileBadge
            :address="sharedAddress"
            :name="sharedIdentity?.name"
            :profile-url="sharedProfileUrl"
            size="x-small"
          />
          <div class="basis-full h-0 sm:hidden"></div>
          <span class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ isUnfollow ? 'unfollowed' : 'followed' }} {{ transactions.length }} people {{ isUnfollow ? '👋' : '👤' }}
          </span>
          <div class="flex items-center -space-x-1">
            <a
              v-for="tx in previewTxs"
              :key="tx.transactionHash"
              :href="`https://universaleverything.io/${getTarget(tx)}`"
              target="_blank"
              rel="noopener noreferrer"
              class="block"
            >
              <lukso-profile
                :profile-url="getProfileUrl(getTarget(tx))"
                :profile-address="getTarget(tx)"
                has-identicon
                size="x-small"
              ></lukso-profile>
            </a>
            <span v-if="transactions.length > 5" class="text-xs text-neutral-400 dark:text-neutral-500 ml-6 pl-2">
              +{{ transactions.length - 5 }}
            </span>
          </div>
        </template>

        <!-- Multiple actors → same target -->
        <template v-else>
          <div class="flex items-center -space-x-1">
            <a
              v-for="tx in previewTxs"
              :key="tx.transactionHash"
              :href="`https://universaleverything.io/${getActor(tx)}`"
              target="_blank"
              rel="noopener noreferrer"
              class="block"
            >
              <lukso-profile
                :profile-url="getProfileUrl(getActor(tx))"
                :profile-address="getActor(tx)"
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
            {{ transactions.length }} people {{ isUnfollow ? 'unfollowed' : 'followed' }} {{ isUnfollow ? '👋' : '👤' }}
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

    <!-- Expanded: individual follow cards -->
    <div v-if="expanded" class="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800 nested-cards">
      <FollowCard
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
import { optimizeImageUrl } from '../../lib/formatters'
import {
  FOLLOW_EVENT, UNFOLLOW_EVENT, EXECUTED_EVENT,
  LSP26_FOLLOW_NOTIFICATION, LSP26_UNFOLLOW_NOTIFICATION,
  findLogByEvent, decodeAddressPairFromData,
  findURByTypeId, getAddressFromURReceivedData
} from '../../lib/events'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import FollowCard from './FollowCard.vue'

const props = defineProps<{
  transactions: Transaction[]
  chainId: number
  groupType: 'same-actor' | 'same-target'
  sharedAddress: string
  isUnfollow: boolean
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const expanded = ref(false)
const previewTxs = computed(() => props.transactions.slice(0, 5))

// Queue address resolution for all addresses in the group
watchEffect(() => {
  const addrs = [props.sharedAddress, ...props.transactions.map(tx => tx.from)].filter(Boolean)
  if (addrs.length) queueResolve(props.chainId, addrs)
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

function getActor(tx: Transaction): string {
  const followLog = findLogByEvent(tx.logs, FOLLOW_EVENT) || findLogByEvent(tx.logs, UNFOLLOW_EVENT)
  if (followLog?.args) {
    const actor = followLog.args.find((a: any) => a.name === 'follower' || a.name === 'unfollower')
    if (actor?.value) return String(actor.value)
  }
  if (followLog) {
    const pair = decodeAddressPairFromData(followLog.data)
    if (pair) return pair[0]
  }
  const executed = findLogByEvent(tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address
  const followUR = findURByTypeId(tx.logs, LSP26_FOLLOW_NOTIFICATION) || findURByTypeId(tx.logs, LSP26_UNFOLLOW_NOTIFICATION)
  const urAddr = getAddressFromURReceivedData(followUR)
  if (urAddr) return urAddr
  return tx.from
}

function getTarget(tx: Transaction): string {
  const followLog = findLogByEvent(tx.logs, FOLLOW_EVENT) || findLogByEvent(tx.logs, UNFOLLOW_EVENT)
  if (followLog?.args) {
    const target = followLog.args.find((a: any) => a.name === 'followed' || a.name === 'unfollowed')
    if (target?.value) return String(target.value)
  }
  if (followLog) {
    const pair = decodeAddressPairFromData(followLog.data)
    if (pair) return pair[1]
  }
  const args = tx.args
  if (args) {
    const addr = args.find(a => a.name === 'addr')
    if (addr && typeof addr.value === 'string') return addr.value
  }
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
