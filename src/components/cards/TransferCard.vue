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
        <span class="text-sm text-neutral-500 dark:text-neutral-400">liked with</span>
        <a
          :href="`https://universaleverything.io/asset/${tx.to}`"
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
            :href="`https://universaleverything.io/asset/${tx.to}`"
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
            :href="`https://universaleverything.io/asset/${tx.to}`"
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

// The actual sender — for decoded txs, use args.from if available (the UP that initiated)
const senderAddress = computed(() => {
  const args = props.tx.args
  if (args) {
    const from = args.find(a => a.name === 'from')
    if (from && typeof from.value === 'string') return from.value
  }
  return props.tx.from
})

const fromIdentity = computed(() => getIdentity(senderAddress.value))

const senderIsAsset = computed(() => {
  const identity = fromIdentity.value
  if (!identity) return false
  return identity.isLSP7 === true ||
    identity.__gqltype === 'Asset' ||
    identity.standard?.includes('LSP7') ||
    identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const senderAssetName = computed(() => {
  const identity = fromIdentity.value
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.name) return identity.name
  return 'Token'
})

const senderIconUrl = computed(() => {
  const identity = fromIdentity.value
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
    return optimizeImageUrl(src, 24) // w-6 = 24px
  }
  return ''
})

const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 32)
})

// Determine transfer type
const transferType = computed(() => {
  const standard = props.tx.standard?.toLowerCase() ?? ''
  if (standard.includes('lsp8') || standard.includes('identifiabledigitalasset')) return 'lsp8'
  if (standard.includes('lsp7') || standard.includes('digitalasset')) return 'lsp7'
  return 'lyx'
})

// Extract receiver address from args or fallback to tx.to
const receiver = computed(() => {
  const args = props.tx.args
  if (args) {
    const to = args.find(a => a.name === 'to')
    if (to && typeof to.value === 'string') return to.value
  }
  return props.tx.to
})

const toIdentity = computed(() => getIdentity(receiver.value))

// Check if receiver is an asset (LSP7/LSP8) rather than a profile
const receiverIsAsset = computed(() => {
  const identity = toIdentity.value
  if (!identity) return false
  return identity.isLSP7 === true ||
    identity.__gqltype === 'Asset' ||
    identity.standard?.includes('LSP7') ||
    identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const receiverAssetName = computed(() => {
  const identity = toIdentity.value
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.name) return identity.name
  return ''
})

const receiverIconUrl = computed(() => {
  const identity = toIdentity.value
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
    return optimizeImageUrl(src, 24) // w-6 = 24px
  }
  return ''
})

const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 32)
})

// Detect "like" action: LIKES token sent to an NFT/asset contract
const LIKES_TOKEN = '0x403bfd53617555295347e0f7725cfda480ab801e'

const isLikeAction = computed(() => {
  if (transferType.value !== 'lsp7') return false
  // Check if token contract is LIKES (by address or symbol)
  const isLikesToken = props.tx.to?.toLowerCase() === LIKES_TOKEN ||
    tokenContractIdentity.value?.lsp4TokenSymbol?.toUpperCase() === 'LIKES'
  if (!isLikesToken) return false
  // Receiver is an asset, OR receiver is unknown (not a profile with a name/images)
  if (receiverIsAsset.value) return true
  const identity = toIdentity.value
  if (!identity || (!identity.name && !identity.profileImages?.length)) return true
  return false
})

// Fetch LIKES count and moment details when like action is detected
let likesFetched = false
watch(isLikeAction, (isLike) => {
  if (isLike && !likesFetched) {
    likesFetched = true
    const addr = receiver.value
    if (!addr) return

    fetchLikesBalance(addr).then(count => {
      if (count) receiverLikesCount.value = count
    })

    // If receiver has no identity data, fetch from Envio + resolve API
    fetchTokenName(addr).then(meta => {
      if (meta) {
        if (meta.name) envioMomentName.value = meta.name
        if (meta.lsp4TokenName) envioCollectionName.value = meta.lsp4TokenName
      }
    })
  }
}, { immediate: true })

// Detect Forever Moments posts: ERC725Y contracts that aren't LSP7/LSP8 tokens
const isForeverMoments = computed(() => {
  const identity = toIdentity.value
  if (!identity) return false
  // Not a known token standard, but has data (resolved with owner/creator)
  return !identity.isLSP7 &&
    !identity.standard?.includes('LSP7') &&
    !identity.standard?.includes('LSP8') &&
    (identity.standard === 'UnknownContract' || identity.__gqltype === 'Asset' || !identity.standard)
})

const likedAssetUrl = computed(() => {
  if (isForeverMoments.value) {
    return `https://www.forevermoments.life/moments/${receiver.value}`
  }
  return `https://universaleverything.io/asset/${receiver.value}`
})

// NFT image for the liked asset (use images[] for artwork, icons[] as fallback)
const receiverNftImageUrl = computed(() => {
  const identity = toIdentity.value
  // Prefer images (artwork) over icons
  const images = identity?.images
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    const src = (sorted.find(i => i.width >= 120) || sorted[sorted.length - 1]).src
    return optimizeImageUrl(src, 140) // w-[140px]
  }
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    const src = (sorted.find(i => i.width >= 120) || sorted[sorted.length - 1]).src
    return optimizeImageUrl(src, 140)
  }
  return ''
})


// Individual moment/token name (from Envio 'name' field)
const receiverMomentName = computed(() => {
  return toIdentity.value?.name || envioMomentName.value || ''
})

// Collection name (from Envio 'lsp4TokenName' — e.g. "Forever Moments")
// Only show if different from the moment name
const receiverCollectionName = computed(() => {
  const collection = toIdentity.value?.lsp4TokenName || envioCollectionName.value || ''
  const moment = receiverMomentName.value
  // Don't show collection name if it's the same as the moment name
  if (collection && moment && collection !== moment) return collection
  return ''
})

const receiverAssetSymbol = computed(() => {
  return toIdentity.value?.lsp4TokenSymbol || ''
})

// Creator address from lsp4Creators
const receiverCreatorAddress = computed(() => {
  const identity = toIdentity.value
  const creators = (identity as any)?.lsp4Creators
  if (creators?.length) {
    return creators[0].profile_id || creators[0].address || ''
  }
  return identity?.owner_id || ''
})

const creatorIdentity = computed(() => {
  const addr = receiverCreatorAddress.value
  if (!addr) return undefined
  // Queue resolution if not yet resolved
  const identity = getIdentity(addr)
  if (!identity) {
    queueResolve(props.chainId, [addr])
  }
  return identity
})

const creatorProfileUrl = computed(() => {
  const images = creatorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

// Format amounts
const formattedAmount = computed(() => {
  if (transferType.value === 'lyx') {
    return formatLYX(props.tx.value || '0')
  }
  return ''
})

const tokenAmount = computed(() => {
  const args = props.tx.args
  if (!args) return ''
  const amount = args.find(a => a.name === 'amount')
  if (amount) {
    try {
      let rawValue = amount.value
      // Handle array of bytes (e.g. [1,1,1,...]) — convert to hex string
      if (Array.isArray(rawValue)) {
        const hex = '0x' + rawValue.map((b: number) => b.toString(16).padStart(2, '0')).join('')
        rawValue = hex
      }
      const val = BigInt(String(rawValue))
      const dec = BigInt(tokenDecimals.value)
      if (dec === 0n) {
        const s = val.toString()
        // Abbreviate very large numbers
        if (s.length > 12) {
          const exp = s.length - 1
          return `${s[0]}.${s.slice(1, 4)}e${exp}`
        }
        // Add thousand separators for medium numbers
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
      return String(amount.value).length > 30 ? '' : String(amount.value)
    }
  }
  return ''
})

// Token contract identity (tx.to is the token contract for LSP7/LSP8)
const tokenContractIdentity = computed(() => {
  if (transferType.value === 'lyx') return undefined
  return getIdentity(props.tx.to)
})

const tokenDecimals = computed(() => {
  return tokenContractIdentity.value?.decimals ?? 18
})


// Display name: use symbol for compact display
const tokenDisplayName = computed(() => {
  const identity = tokenContractIdentity.value
  if (identity?.lsp4TokenSymbol) return identity.lsp4TokenSymbol
  if (identity?.lsp4TokenName) return identity.lsp4TokenName
  if (identity?.name) return identity.name
  if (props.tx.toName && transferType.value !== 'lyx') return props.tx.toName
  return transferType.value === 'lsp8' ? 'NFT' : 'Token'
})

const tokenIconUrl = computed(() => {
  const identity = tokenContractIdentity.value
  // Token assets use 'icons' not 'profileImages'
  const icons = identity?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
    return optimizeImageUrl(src, 16) // w-4 = 16px
  }
  // Fallback to profileImages
  const images = identity?.profileImages
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
    return optimizeImageUrl(src, 16)
  }
  return ''
})

</script>
