<template>
  <!-- Like action: token sent to an NFT/asset (e.g. LIKES → Forever Moments NFT) -->
  <ExtendedCard v-if="isLikeAction" :tx="(tx as any)">
    <template #header>
      <div class="flex items-center gap-2">
        <ProfileBadge
          :address="senderAddress"
          :name="fromIdentity?.name"
          :profile-url="fromProfileUrl"
          size="x-small"
        />
        <span class="text-sm text-neutral-500 dark:text-neutral-400">{{ isLikesTransfer ? 'liked with' : 'sent' }}</span>
        <a
          :href="`https://universaleverything.io/asset/${tokenContractAddress}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
          <span>{{ tokenAmount }} {{ tokenDisplayName }}</span>
        </a>
      </div>
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </template>
    <template #content>
      <a
        :href="likedAssetUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-start gap-4 hover:opacity-90 transition-opacity no-underline"
      >
        <!-- NFT image card -->
        <div class="flex-shrink-0 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          <div class="relative">
            <img
              v-if="receiverNftImageUrl"
              :src="receiverNftImageUrl"
              class="w-[140px] h-[140px] object-cover"
              :alt="receiverAssetName"
              loading="lazy"
            />
            <div v-else class="w-[140px] h-[140px] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <lukso-profile
                :profile-address="receiver"
                has-identicon
                size="x-large"
              ></lukso-profile>
            </div>
          </div>
          <!-- Address bar below image -->
          <div class="px-2 py-1.5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
            <span class="text-xs text-neutral-500 font-mono">{{ shortenAddress(receiver) }}</span>
          </div>
        </div>
        <!-- NFT details -->
        <div class="flex flex-col gap-1.5 min-w-0 py-1">
          <span v-if="receiverCollectionName" class="text-sm text-neutral-500 dark:text-neutral-400 truncate">
            {{ receiverCollectionName }}
          </span>
          <span class="text-lg font-bold text-neutral-800 dark:text-neutral-200 truncate">
            {{ receiverMomentName || receiverAssetSymbol || receiverAssetName || 'NFT' }}
          </span>
          <span v-if="!receiverMomentName && !receiverAssetSymbol && !receiverAssetName" class="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
            {{ shortenAddress(receiver) }}
          </span>
          <!-- Creator info -->
          <div v-if="receiverCreatorAddress" class="mt-1">
            <span class="text-xs text-neutral-400 dark:text-neutral-500">Created by</span>
            <div class="mt-1">
              <ProfileBadge
                :address="receiverCreatorAddress"
                :name="creatorIdentity?.name"
                :profile-url="creatorProfileUrl"
                size="x-small"
              />
            </div>
          </div>
          <span v-else class="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
            {{ shortenAddress(receiver) }}
          </span>
          <!-- LIKES count -->
          <div v-if="receiverLikesCount && receiverLikesCount !== '0'" class="mt-2">
            <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">{{ receiverLikesCount }} LIKES</span>
          </div>
        </div>
      </a>
    </template>
  </ExtendedCard>

  <!-- Standard transfer card -->
  <div v-else class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4">
    <div class="flex gap-2">
    <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1">
      <!-- Actor (sender) -->
      <template v-if="senderIsAsset">
        <a
          :href="`https://universaleverything.io/asset/${tx.from}`"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
        >
          <img v-if="senderIconUrl" :src="senderIconUrl" class="w-6 h-6 rounded-full" :alt="senderAssetName" />
          <span class="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{{ senderAssetName }}</span>
        </a>
      </template>
      <ProfileBadge
        v-else
        :address="senderAddress"
        :name="fromIdentity?.name"
        :profile-url="fromProfileUrl"
        size="x-small"
      />

      <div class="basis-full h-0 sm:hidden"></div>

      <!-- Action text -->
      <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
        <template v-if="transferType === 'lyx'">
          Sent <span class="font-medium text-neutral-800 dark:text-neutral-200">{{ formattedAmount }}</span> to
        </template>
        <template v-else-if="transferType === 'lsp7'">
          Sent
          <a
            :href="`https://universaleverything.io/asset/${tokenContractAddress}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
          >
            <span>{{ tokenAmount }}</span>
            <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
            <span>{{ tokenDisplayName }}</span>
          </a> to
        </template>
        <template v-else>
          Sent
          <a
            :href="`https://universaleverything.io/asset/${tokenContractAddress}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
          >
            <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
            <span>{{ tokenDisplayName }}</span>
          </a> to
        </template>
      </span>

      <div class="basis-full h-0 sm:hidden"></div>

      <!-- Target (receiver) -->
      <template v-if="receiverIsAsset">
        <a
          :href="`https://universaleverything.io/asset/${receiver}`"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
        >
          <img v-if="receiverIconUrl" :src="receiverIconUrl" class="w-6 h-6 rounded-full" :alt="receiverAssetName" />
          <span class="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{{ receiverAssetName }}</span>
        </a>
      </template>
      <ProfileBadge
        v-else
        :address="receiver"
        :name="toIdentity?.name"
        :profile-url="toProfileUrl"
        size="x-small"
      />

      <!-- Timestamp -->
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </div>
    <!-- Chevron — always top-right -->
    <button
      @click="detailsExpanded = !detailsExpanded"
      class="flex-shrink-0 self-start mt-1 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-all"
    >
      <svg
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': detailsExpanded }"
        fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>
    </div>
    <TxDetails v-if="detailsExpanded" :tx="(tx as any)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { formatLYX, shortenAddress, optimizeImageUrl } from '../../lib/formatters'
import { fetchLikesBalance, fetchTokenName } from '../../lib/api'
import ExtendedCard from './ExtendedCard.vue'
import TxDetails from '../shared/TxDetails.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()
const detailsExpanded = ref(false)
const receiverLikesCount = ref<string | null>(null)
const envioMomentName = ref<string | null>(null)
const envioCollectionName = ref<string | null>(null)

// ─── Helper: get a named arg value ───
function getArg(name: string): unknown {
  return props.tx.args?.find(a => a.name === name)?.value
}
function getArgString(name: string): string {
  const v = getArg(name)
  return typeof v === 'string' ? v : ''
}

// ─── Transfer type from decoded standard ───
const transferType = computed(() => {
  const standard = props.tx.standard?.toLowerCase() ?? ''
  if (standard.includes('lsp8') || standard.includes('identifiabledigitalasset')) return 'lsp8'
  if (standard.includes('lsp7') || standard.includes('digitalasset')) return 'lsp7'
  return 'lyx'
})

// ─── Sender: args.from (for token transfers) or tx.from (for LYX) ───
const senderAddress = computed(() => getArgString('from') || props.tx.from)
const fromIdentity = computed(() => getIdentity(senderAddress.value))

const senderIsAsset = computed(() => {
  const identity = fromIdentity.value
  if (!identity) return false
  return identity.__gqltype === 'Asset' || identity.isLSP7 === true ||
    !!identity.standard?.includes('LSP7') || !!identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const senderAssetName = computed(() => {
  const identity = fromIdentity.value
  return identity?.lsp4TokenSymbol || identity?.lsp4TokenName || identity?.name || 'Token'
})

const senderIconUrl = computed(() => {
  const icons = fromIdentity.value?.icons
  if (!icons?.length) return ''
  const sorted = [...icons].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
})

// ─── Receiver: args.to (for token transfers) or tx.to (for LYX) ───
const receiver = computed(() => getArgString('to') || props.tx.to)
const toIdentity = computed(() => getIdentity(receiver.value))

const receiverIsAsset = computed(() => {
  const identity = toIdentity.value
  if (!identity) return false
  return identity.__gqltype === 'Asset' || identity.isLSP7 === true ||
    !!identity.standard?.includes('LSP7') || !!identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const receiverIsProfile = computed(() => {
  const identity = toIdentity.value
  if (!identity) return false
  return !!(identity.profileImages?.length) || identity.__gqltype === 'Profile'
})

const receiverAssetName = computed(() => {
  const identity = toIdentity.value
  return identity?.lsp4TokenName || identity?.lsp4TokenSymbol || identity?.name || ''
})

const receiverIconUrl = computed(() => {
  const icons = toIdentity.value?.icons
  if (!icons?.length) return ''
  const sorted = [...icons].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
})

// ─── Token contract: tx.to is always the token contract (API unwraps KM/UP layers) ───
const LIKES_TOKEN = '0x403bfd53617555295347e0f7725cfda480ab801e'

const tokenContractAddress = computed(() => props.tx.to)

const tokenContractIdentity = computed(() => {
  if (transferType.value === 'lyx') return undefined
  return getIdentity(tokenContractAddress.value)
})

const tokenDecimals = computed(() => tokenContractIdentity.value?.decimals ?? 18)

const isLikesTransfer = computed(() =>
  tokenContractAddress.value?.toLowerCase() === LIKES_TOKEN ||
  tokenContractIdentity.value?.lsp4TokenSymbol?.toUpperCase() === 'LIKES'
)

// ─── NFT preview: show when receiver is an asset, not a profile ───
const isLikeAction = computed(() => {
  if (transferType.value !== 'lsp7' && transferType.value !== 'lyx') return false
  if (receiverIsProfile.value) return false
  if (receiverIsAsset.value) return true
  if (envioMomentName.value || envioCollectionName.value) return true
  return false
})

// Fetch Envio data for receiver (determines if it's an asset + gets moment details)
let envioFetched = false
watch(() => receiver.value, (addr) => {
  if (addr && !envioFetched && (transferType.value === 'lsp7' || transferType.value === 'lyx')) {
    envioFetched = true
    fetchTokenName(addr).then(meta => {
      if (meta) {
        if (meta.name) envioMomentName.value = meta.name
        if (meta.lsp4TokenName) envioCollectionName.value = meta.lsp4TokenName
      }
    })
    fetchLikesBalance(addr).then(count => {
      if (count) receiverLikesCount.value = count
    })
  }
}, { immediate: true })

const isForeverMoments = computed(() => {
  if (envioCollectionName.value === 'Forever Moments') return true
  const identity = toIdentity.value
  return identity?.lsp4TokenName === 'Forever Moments' || false
})

const likedAssetUrl = computed(() =>
  isForeverMoments.value
    ? `https://www.forevermoments.life/moments/${receiver.value}`
    : `https://universaleverything.io/asset/${receiver.value}`
)

// ─── NFT image for liked asset ───
const receiverNftImageUrl = computed(() => {
  const identity = toIdentity.value
  const images = identity?.images
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 120) || sorted[sorted.length - 1]).src, 140)
  }
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 120) || sorted[sorted.length - 1]).src, 140)
  }
  return ''
})

const receiverMomentName = computed(() => toIdentity.value?.name || envioMomentName.value || '')

const receiverCollectionName = computed(() => {
  const collection = toIdentity.value?.lsp4TokenName || envioCollectionName.value || ''
  const moment = receiverMomentName.value
  return (collection && moment && collection !== moment) ? collection : ''
})

const receiverAssetSymbol = computed(() => toIdentity.value?.lsp4TokenSymbol || '')

// ─── Creator info ───
const receiverCreatorAddress = computed(() => {
  const identity = toIdentity.value
  const creators = (identity as any)?.lsp4Creators
  if (creators?.length) return creators[0].profile_id || creators[0].address || ''
  return identity?.owner_id || ''
})

const creatorIdentity = computed(() => {
  const addr = receiverCreatorAddress.value
  if (!addr) return undefined
  const identity = getIdentity(addr)
  if (!identity) queueResolve(props.chainId, [addr])
  return identity
})

const creatorProfileUrl = computed(() => {
  const images = creatorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

// ─── Amount formatting ───
const formattedAmount = computed(() => {
  if (transferType.value === 'lyx') return formatLYX(props.tx.value || '0')
  return ''
})

// Token amount: directly from args.amount (API pre-decodes it)
const tokenAmount = computed(() => {
  const rawAmount = getArg('amount')
  if (rawAmount == null) return ''
  try {
    const val = BigInt(String(rawAmount))
    const dec = BigInt(tokenDecimals.value)
    if (dec === 0n) {
      const s = val.toString()
      if (s.length > 12) return `${s[0]}.${s.slice(1, 4)}e${s.length - 1}`
      if (s.length > 3) return Number(val).toLocaleString('en-US')
      return s
    }
    const divisor = 10n ** dec
    const whole = val / divisor
    const frac = val % divisor
    if (frac === 0n) return whole.toString()
    const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 4)
    return `${whole}.${fracStr}`
  } catch {
    return String(rawAmount).length > 30 ? '' : String(rawAmount)
  }
})

// ─── Token display ───
const tokenDisplayName = computed(() => {
  const identity = tokenContractIdentity.value
  return identity?.lsp4TokenSymbol || identity?.lsp4TokenName || identity?.name ||
    (transferType.value === 'lsp8' ? 'NFT' : 'Token')
})

const tokenIconUrl = computed(() => {
  const identity = tokenContractIdentity.value
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
  }
  const images = identity?.profileImages
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
  }
  return ''
})

</script>
