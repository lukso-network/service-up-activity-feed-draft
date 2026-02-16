<template>
  <div class="space-y-3 p-4">
    <TransitionGroup name="tx-list">
      <div
        v-for="item in displayItems"
        :key="item.key"
      >
        <!-- Follow group -->
        <FollowGroupCard
          v-if="item.type === 'follow-group'"
          :transactions="item.transactions!"
          :chain-id="chainId"
          :group-type="item.groupType!"
          :shared-address="item.sharedAddress!"
          :is-unfollow="item.isUnfollow!"
        />
        <!-- Regular transaction -->
        <component
          v-else
          :is="getCardComponent(item.tx!)"
          :tx="item.tx!"
          :chain-id="chainId"
        />
      </div>
    </TransitionGroup>

    <!-- Infinite scroll sentinel -->
    <div v-if="hasMore" ref="sentinel" class="flex justify-center py-4">
      <svg v-if="loadingMore" class="animate-spin w-5 h-5 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Empty state -->
    <div v-if="!transactions.length && !loading" class="py-16 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center">
        <svg class="w-8 h-8 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p class="text-neutral-500 dark:text-neutral-400 text-sm">No activity found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import type { Component } from 'vue'
import type { Transaction } from '../lib/types'
import { useAddressResolver } from '../composables/useAddressResolver'
import { classifyTransaction } from '../lib/formatters'
import { LIKES_CONTRACT } from '../lib/events'
import TransferCard from './cards/TransferCard.vue'
import FollowCard from './cards/FollowCard.vue'
import RawTransactionCard from './cards/RawTransactionCard.vue'
import ProfileUpdateCard from './cards/ProfileUpdateCard.vue'
import PermissionCard from './cards/PermissionCard.vue'
import GenericCard from './cards/GenericCard.vue'
import MomentCard from './cards/MomentCard.vue'
import TokenUpdateCard from './cards/TokenUpdateCard.vue'
import FollowGroupCard from './cards/FollowGroupCard.vue'
import {
  FOLLOW_EVENT, UNFOLLOW_EVENT, EXECUTED_EVENT,
  LSP26_FOLLOW_NOTIFICATION, LSP26_UNFOLLOW_NOTIFICATION,
  findLogByEvent, decodeAddressPairFromData,
  findURByTypeId, getAddressFromURReceivedData
} from '../lib/events'

const props = defineProps<{
  transactions: Transaction[]
  chainId: number
  profileAddress: string
  hasMore: boolean
  loadingMore: boolean
  loading: boolean
}>()

const emit = defineEmits<{ loadMore: [] }>()

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasMore && !props.loadingMore) {
        emit('loadMore')
      }
    },
    { rootMargin: '200px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

watch(sentinel, (el) => {
  if (observer && el) observer.observe(el)
})

// Re-trigger observer when loading completes — if all fetched items were filtered,
// the sentinel stays in viewport but observer won't re-fire (only fires on state changes)
watch(() => props.loadingMore, (curr, prev) => {
  if (prev && !curr && sentinel.value && observer) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

const { getIdentity } = useAddressResolver()

/**
 * Flatten batch transfers to FM NFTs into individual virtual transactions.
 * A transferBatch where recipients are Forever Moments NFTs (Assets, not Profiles)
 * gets split into separate "liked with" cards.
 *
 * Detection: recipients resolve as __gqltype="Asset" (not "Profile").
 * This is reactive — re-evaluates when address identities resolve.
 */
// LIKES_CONTRACT kept in events.ts for reference; batch splitting uses recipient identity check

const flattenedTransactions = computed(() => {
  const result: (Transaction & { _virtualKey?: string })[] = []
  for (const tx of props.transactions) {
    const toArg = tx.args?.find(a => a.name === 'to')
    const amountArg = tx.args?.find(a => a.name === 'amount')
    const fromArg = tx.args?.find(a => a.name === 'from')
    
    if (tx.functionName === 'transferBatch' && 
        Array.isArray(toArg?.value) && Array.isArray(amountArg?.value)) {
      const toArr = toArg!.value as string[]
      const amountArr = amountArg!.value as unknown[]
      const fromArr = Array.isArray(fromArg?.value) ? fromArg!.value as string[] : []
      
      // Check if this is a LIKES batch transfer to FM moments
      // tx.to may be KeyManager, so also check Executed log target and wrappers
      const likesAddr = LIKES_CONTRACT.toLowerCase()
      const isLikesBatch = tx.to?.toLowerCase() === likesAddr ||
        (tx.logs as any[])?.some((l: any) => 
          l.eventName === 'Executed' && l.args?.some((a: any) => 
            a.name === 'target' && String(a.value).toLowerCase() === likesAddr)) ||
        (tx as any).wrappers?.some((w: any) => 
          w.args?.some((a: any) => a.name === 'target' && String(a.value).toLowerCase() === likesAddr))

      // Also check if recipients resolve as Assets
      const recipientsAreAssets = isLikesBatch || toArr.some(addr => {
        const identity = getIdentity(String(addr)) as any
        if (!identity) return false
        return identity.__gqltype === 'Asset' ||
          identity.isLSP7 === true ||
          (identity.standard && (identity.standard.includes('LSP7') || identity.standard.includes('LSP8'))) ||
          !!identity.lsp4TokenName
      })
      
      if (recipientsAreAssets) {
        // Split into individual virtual transactions → each renders as "liked with"
        const dataArg = tx.args?.find(a => a.name === 'data')
        const dataArr = Array.isArray(dataArg?.value) ? dataArg!.value as string[] : []
        for (let i = 0; i < toArr.length; i++) {
          const virtualTx: Transaction & { _virtualKey?: string } = {
            ...tx,
            _virtualKey: `${tx.transactionHash}-${i}`,
            args: [
              { name: 'from', internalType: 'address', type: 'address', value: fromArr[i] || fromArr[0] || tx.from },
              { name: 'to', internalType: 'address', type: 'address', value: String(toArr[i]) },
              { name: 'amount', internalType: 'uint256', type: 'uint256', value: amountArr[i] },
              { name: 'force', internalType: 'bool', type: 'bool', value: false },
              { name: 'data', internalType: 'bytes', type: 'bytes', value: dataArr[i] || '0x' },
            ],
            functionName: 'transfer',
          }
          result.push(virtualTx)
        }
        continue
      }
    }
    result.push(tx)
  }
  return result
})

// --- Follow grouping helpers ---

function getFollowActor(tx: Transaction): string {
  const followLog = findLogByEvent(tx.logs, FOLLOW_EVENT) || findLogByEvent(tx.logs, UNFOLLOW_EVENT)
  if (followLog?.args) {
    const actor = followLog.args.find((a: any) => a.name === 'follower' || a.name === 'unfollower')
    if (actor?.value) return String(actor.value).toLowerCase()
  }
  if (followLog) {
    const pair = decodeAddressPairFromData(followLog.data)
    if (pair) return pair[0].toLowerCase()
  }
  const executed = findLogByEvent(tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address.toLowerCase()
  const followUR = findURByTypeId(tx.logs, LSP26_FOLLOW_NOTIFICATION) || findURByTypeId(tx.logs, LSP26_UNFOLLOW_NOTIFICATION)
  const urAddr = getAddressFromURReceivedData(followUR)
  if (urAddr) return urAddr.toLowerCase()
  return tx.from.toLowerCase()
}

function getFollowTarget(tx: Transaction): string {
  const followLog = findLogByEvent(tx.logs, FOLLOW_EVENT) || findLogByEvent(tx.logs, UNFOLLOW_EVENT)
  if (followLog?.args) {
    const target = followLog.args.find((a: any) => a.name === 'followed' || a.name === 'unfollowed')
    if (target?.value) return String(target.value).toLowerCase()
  }
  if (followLog) {
    const pair = decodeAddressPairFromData(followLog.data)
    if (pair) return pair[1].toLowerCase()
  }
  const args = tx.args
  if (args) {
    const addr = args.find(a => a.name === 'addr')
    if (addr && typeof addr.value === 'string') return addr.value.toLowerCase()
  }
  return (tx.to || '').toLowerCase()
}

type DisplayItem = {
  key: string
  type: 'tx' | 'follow-group'
  tx?: Transaction & { _virtualKey?: string }
  transactions?: Transaction[]
  groupType?: 'same-actor' | 'same-target'
  sharedAddress?: string
  isUnfollow?: boolean
}

const displayItems = computed<DisplayItem[]>(() => {
  const txs = flattenedTransactions.value
  const items: DisplayItem[] = []
  let i = 0


  while (i < txs.length) {
    const tx = txs[i]
    const { type } = classifyTransaction(tx)

    if (type === 'follow' || type === 'unfollow') {
      // Collect consecutive follows/unfollows of the same type
      const isUnfollow = type === 'unfollow'
      const run: (Transaction & { _virtualKey?: string })[] = [tx]
      let j = i + 1
      while (j < txs.length) {
        const { type: nextType } = classifyTransaction(txs[j])
        if ((isUnfollow && nextType === 'unfollow') || (!isUnfollow && nextType === 'follow')) {
          run.push(txs[j])
          j++
        } else {
          break
        }
      }

      // Greedily split the run into sub-groups by shared actor or target
      let r = 0
      while (r < run.length) {
        const actor = getFollowActor(run[r])
        const target = getFollowTarget(run[r])
        // Try same-actor sub-group
        let end = r + 1
        while (end < run.length && getFollowActor(run[end]) === actor) end++
        const actorGroupLen = end - r
        // Try same-target sub-group
        let endT = r + 1
        while (endT < run.length && getFollowTarget(run[endT]) === target) endT++
        const targetGroupLen = endT - r

        // Pick the larger sub-group (prefer actor grouping)
        if (actorGroupLen >= 2 && actorGroupLen >= targetGroupLen) {
          items.push({
            key: `follow-group-${run[r].transactionHash}`,
            type: 'follow-group',
            transactions: run.slice(r, end),
            groupType: 'same-actor',
            sharedAddress: actor,
            isUnfollow,
          })
          r = end
        } else if (targetGroupLen >= 2) {
          items.push({
            key: `follow-group-${run[r].transactionHash}`,
            type: 'follow-group',
            transactions: run.slice(r, endT),
            groupType: 'same-target',
            sharedAddress: target,
            isUnfollow,
          })
          r = endT
        } else {
          // Single follow, no group
          const t = run[r]
          items.push({ key: (t as any)._virtualKey || t.transactionHash, type: 'tx', tx: t })
          r++
        }
      }
      i = j
    } else if (type === 'profile_update') {
      // Group consecutive profile updates from same person with same update type
      const run: (Transaction & { _virtualKey?: string })[] = [tx]
      const actor = tx.to?.toLowerCase() || tx.from.toLowerCase()
      let j = i + 1
      while (j < txs.length) {
        const { type: nextType } = classifyTransaction(txs[j])
        const nextActor = txs[j].to?.toLowerCase() || txs[j].from.toLowerCase()
        if (nextType === 'profile_update' && nextActor === actor) {
          run.push(txs[j])
          j++
        } else {
          break
        }
      }

      if (run.length >= 2) {
        // Collapse into single card — attach all grouped txs for pagination
        const representative = { ...run[0], _groupCount: run.length, _groupTxs: run } as any
        items.push({ key: run[0].transactionHash, type: 'tx', tx: representative })
      } else {
        items.push({ key: tx.transactionHash, type: 'tx', tx })
      }
      i = j
    } else {
      items.push({ key: (tx as any)._virtualKey || tx.transactionHash, type: 'tx', tx })
      i++
    }
  }
  return items
})

function getCardComponent(tx: Transaction): Component {
  const { type } = classifyTransaction(tx)
  switch (type) {
    case 'value_transfer':
    case 'token_transfer':
    case 'nft_transfer':
    case 'token_mint':
    case 'nft_mint':
      return TransferCard
    case 'follow':
    case 'unfollow':
      return FollowCard
    case 'create_moment':
      return MomentCard
    case 'profile_update':
      return ProfileUpdateCard
    case 'token_metadata_update':
      return TokenUpdateCard
    case 'permission_change':
      return PermissionCard
    case 'contract_execution':
      return GenericCard
    case 'unknown':
      return RawTransactionCard
    default:
      return RawTransactionCard
  }
}
</script>

<style scoped>
.tx-list-enter-active {
  transition: all 0.4s ease-out;
}
.tx-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.tx-list-move {
  transition: transform 0.3s ease;
}
</style>
