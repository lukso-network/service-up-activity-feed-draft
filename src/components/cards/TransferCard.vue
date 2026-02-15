<template>
  <!-- NFT Mint: extended card with NFT preview -->
  <ExtendedCard v-if="isNftMint" :tx="(tx as any)">
    <template #header>
      <div class="flex items-center gap-2">
        <ProfileBadge
          :address="minterAddress"
          :name="minterIdentity?.name"
          :profile-url="minterProfileUrl"
          size="x-small"
        />
        <span class="text-sm text-neutral-500 dark:text-neutral-400">minted</span>
        <a
          :href="`https://universaleverything.io/asset/${mintTokenContract}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <img v-if="mintTokenIconUrl" :src="mintTokenIconUrl" class="w-4 h-4 rounded-full" :alt="mintTokenName" />
          <span>{{ mintAmount }} {{ mintTokenName }}</span>
        </a>
      </div>
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </template>
    <template #content>
      <NftPreview :address="mintTokenContract" :chain-id="chainId" />
    </template>
  </ExtendedCard>

  <!-- Token Mint: compact card -->
  <div v-else-if="isMint" class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4">
    <div class="flex gap-2">
    <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1">
      <ProfileBadge
        :address="minterAddress"
        :name="minterIdentity?.name"
        :profile-url="minterProfileUrl"
        size="x-small"
      />
      <div class="basis-full h-0 sm:hidden"></div>
      <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
        minted
        <a
          :href="`https://universaleverything.io/asset/${mintTokenContract}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <span>{{ mintAmount }}</span>
          <img v-if="mintTokenIconUrl" :src="mintTokenIconUrl" class="w-4 h-4 rounded-full" :alt="mintTokenName" />
          <span>{{ mintTokenName }}</span>
        </a>
      </span>
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </div>
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

  <!-- Batch transfer: multiple recipients -->
  <div v-else-if="isBatchTransfer" class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4">
    <div class="flex gap-2">
    <div class="flex items-center gap-2 min-w-0 flex-wrap flex-1">
      <ProfileBadge
        :address="senderAddress"
        :name="fromIdentity?.name"
        :profile-url="fromProfileUrl"
        size="x-small"
      />
      <div class="basis-full h-0 sm:hidden"></div>
      <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1 whitespace-nowrap">
        sent
        <a
          :href="`https://universaleverything.io/asset/${tokenContractAddress}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <span>{{ batchTotalAmount }}</span>
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
          <span>{{ tokenDisplayName }}</span>
        </a>
        to
      </span>
      <!-- Recipient profile icons (up to 5) -->
      <div class="flex items-center -space-x-1">
        <a
          v-for="r in batchPreviewRecipients"
          :key="r.address"
          :href="`https://universaleverything.io/${r.address}`"
          target="_blank"
          rel="noopener noreferrer"
          class="block"
        >
          <lukso-profile
            :profile-url="getBatchProfileUrl(r.address)"
            :profile-address="r.address"
            has-identicon
            size="x-small"
          ></lukso-profile>
        </a>
        <span v-if="batchHasMore" class="text-xs text-neutral-400 dark:text-neutral-500 ml-1.5">+{{ batchCount - 5 }}</span>
      </div>
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </div>
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
    <!-- Expanded: individual recipients + amounts -->
    <div v-if="detailsExpanded" class="mt-3 space-y-2">
      <div
        v-for="r in batchRecipients"
        :key="r.address"
        class="flex items-center gap-2 text-sm"
      >
        <span class="text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
          {{ r.amount }}
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-3.5 h-3.5 rounded-full inline-block mx-0.5 align-text-bottom" :alt="tokenDisplayName" />
          {{ tokenDisplayName }} →
        </span>
        <ProfileBadge
          :address="r.address"
          :name="getIdentity(r.address)?.name"
          size="x-small"
        />
      </div>
      <div class="border-t border-neutral-100 dark:border-neutral-800 pt-2 mt-2">
        <TxDetails :tx="(tx as any)" />
      </div>
    </div>
  </div>

  <!-- NFT card: token is NFT type (lsp4TokenType 1/2), or token sent to an NFT/asset -->
  <!-- NFT token transfer (lsp4TokenType 1/2): sent NFT to a profile -->
  <ExtendedCard v-else-if="isNftToken" :tx="(tx as any)">
    <template #header>
      <ProfileBadge
        :address="senderAddress"
        :name="fromIdentity?.name"
        :profile-url="fromProfileUrl"
        size="x-small"
      />
      <div class="basis-full h-0 sm:hidden"></div>
      <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1 whitespace-nowrap">
        sent
        <a
          :href="`https://universaleverything.io/asset/${tokenContractAddress}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
          <span>{{ tokenAmount }} {{ tokenDisplayName }}</span>
        </a>
        to
      </span>
      <div class="basis-full h-0 sm:hidden"></div>
      <ProfileBadge
        v-if="receiver"
        :address="receiver"
        :name="toIdentity?.name"
        :profile-url="toProfileUrl"
        size="x-small"
      />
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </template>
    <template #content>
      <NftPreview :address="tokenContractAddress" :chain-id="chainId" />
    </template>
  </ExtendedCard>

  <!-- Liked with: tokens sent to a Forever Moments NFT -->
  <ExtendedCard v-else-if="isLikeAction" :tx="(tx as any)">
    <template #header>
      <ProfileBadge
        :address="senderAddress"
        :name="fromIdentity?.name"
        :profile-url="fromProfileUrl"
        size="x-small"
      />
      <div class="basis-full h-0 sm:hidden"></div>
      <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1 whitespace-nowrap">
        {{ isLikesTransfer ? 'liked with' : 'sent' }}
        <a
          :href="`https://universaleverything.io/asset/${tokenContractAddress}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
        >
          <img v-if="tokenIconUrl" :src="tokenIconUrl" class="w-4 h-4 rounded-full" :alt="tokenDisplayName" />
          <span>{{ tokenAmount }} {{ tokenDisplayName }}</span>
        </a>
      </span>
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </template>
    <template #content>
      <FmMomentPreview :address="receiver" :chain-id="chainId" />
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
import { formatLYX, optimizeImageUrl, classifyTransaction } from '../../lib/formatters'
import { fetchTokenName } from '../../lib/api'
import ExtendedCard from './ExtendedCard.vue'
import TxDetails from '../shared/TxDetails.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import NftPreview from '../shared/NftPreview.vue'
import FmMomentPreview from '../shared/FmMomentPreview.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity } = useAddressResolver()
const detailsExpanded = ref(false)
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

// ─── Mint detection: Transfer event from zero address ───
const txType = computed(() => classifyTransaction(props.tx).type)
const isMint = computed(() => txType.value === 'token_mint' || txType.value === 'nft_mint')
const isNftMint = computed(() => txType.value === 'nft_mint')

// Extract mint data from Transfer event log (args may be empty for unknown contracts)
const mintTransferLog = computed(() => {
  if (!isMint.value) return null
  return props.tx.logs?.find((l: any) =>
    l.eventName === 'Transfer' &&
    l.args?.some((a: any) => a.name === 'from' && a.value === '0x0000000000000000000000000000000000000000')
  ) || null
})

function getMintLogArg(name: string): string {
  const arg = mintTransferLog.value?.args?.find((a: any) => a.name === name)
  return typeof arg?.value === 'string' ? arg.value : ''
}

// Minter = who received the token (Transfer event 'to')
const minterAddress = computed(() => getMintLogArg('to'))
const minterIdentity = computed(() => minterAddress.value ? getIdentity(minterAddress.value) : undefined)
const minterProfileUrl = computed(() => {
  const images = minterIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
})

// Mint token contract = Transfer event emitter address
const mintTokenContract = computed(() => mintTransferLog.value?.address || '')

const mintTokenIdentity = computed(() => mintTokenContract.value ? getIdentity(mintTokenContract.value) : undefined)

const mintAmount = computed(() => {
  if (!mintTransferLog.value) return ''
  const amountArg = mintTransferLog.value.args?.find((a: any) => a.name === 'amount')
  if (!amountArg?.value) return '1' // NFT default
  try {
    const val = BigInt(String(amountArg.value))
    const dec = BigInt(mintTokenIdentity.value?.decimals ?? 18)
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
    return String(amountArg.value)
  }
})

const mintTokenName = computed(() =>
  mintTokenIdentity.value?.lsp4TokenSymbol || mintTokenIdentity.value?.lsp4TokenName || mintTokenIdentity.value?.name || 'Token'
)

const mintTokenIconUrl = computed(() => {
  const icons = mintTokenIdentity.value?.icons
  if (!icons?.length) return ''
  const sorted = [...(icons || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
})

// ─── Batch detection: args are arrays for transferBatch ───
const isBatchTransfer = computed(() => {
  const toArg = getArg('to')
  return Array.isArray(toArg)
})

// ─── Transfer type from decoded standard ───
const transferType = computed(() => {
  const standard = props.tx.standard?.toLowerCase() ?? ''
  if (standard.includes('lsp8') || standard.includes('identifiabledigitalasset')) return 'lsp8'
  if (standard.includes('lsp7') || standard.includes('digitalasset')) return 'lsp7'
  return 'lyx'
})

// ─── Sender: args.from (for token transfers) or tx.from (for LYX) ───
const senderAddress = computed(() => {
  const from = getArg('from')
  // For batch transfers, args.from is an array — use first element or tx.from
  if (Array.isArray(from)) return (from[0] as string) || props.tx.from
  return getArgString('from') || props.tx.from
})
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
  const sorted = [...(icons || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
})

// ─── Receiver: args.to (for token transfers) or tx.to (for LYX) ───
// For batch transfers, args.to is an array — don't use it as single receiver
const receiver = computed(() => {
  if (isBatchTransfer.value) return '' // no single receiver for batch
  return getArgString('to') || props.tx.to
})

// Batch: count of recipients
const batchCount = computed(() => {
  if (!isBatchTransfer.value) return 0
  const toArg = getArg('to')
  return Array.isArray(toArg) ? toArg.length : 0
})

// Batch: total amount
const batchTotalAmount = computed(() => {
  if (!isBatchTransfer.value) return ''
  const amounts = getArg('amount')
  if (!Array.isArray(amounts)) return ''
  try {
    let total = 0n
    for (const a of amounts) total += BigInt(String(a))
    const dec = BigInt(tokenDecimals.value)
    if (dec === 0n) return total.toString()
    const divisor = 10n ** dec
    const whole = total / divisor
    const frac = total % divisor
    if (frac === 0n) return whole.toLocaleString('en-US')
    const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 4)
    return `${whole.toLocaleString('en-US')}.${fracStr}`
  } catch { return '' }
})

// Batch: individual recipients with addresses and formatted amounts
const batchRecipients = computed(() => {
  if (!isBatchTransfer.value) return []
  const toArr = getArg('to')
  const amountArr = getArg('amount')
  if (!Array.isArray(toArr) || !Array.isArray(amountArr)) return []
  const dec = BigInt(tokenDecimals.value)
  return toArr.map((addr: unknown, i: number) => {
    const raw = amountArr[i]
    let formatted = ''
    try {
      const val = BigInt(String(raw))
      if (dec === 0n) {
        formatted = Number(val).toLocaleString('en-US')
      } else {
        const divisor = 10n ** dec
        const whole = val / divisor
        const frac = val % divisor
        if (frac === 0n) formatted = whole.toLocaleString('en-US')
        else {
          const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 4)
          formatted = `${whole.toLocaleString('en-US')}.${fracStr}`
        }
      }
    } catch { formatted = String(raw) }
    return { address: String(addr), amount: formatted }
  })
})

// First 5 recipients for preview icons
const batchPreviewRecipients = computed(() => batchRecipients.value.slice(0, 5))
const batchHasMore = computed(() => batchRecipients.value.length > 5)

// Get profile image URL for a batch recipient
function getBatchProfileUrl(address: string): string {
  const identity = getIdentity(address)
  const images = identity?.profileImages
  if (!images?.length) return ''
  const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
}

const toIdentity = computed(() => getIdentity(receiver.value))

const receiverIsAsset = computed(() => {
  const identity = toIdentity.value
  if (!identity) return false
  return identity.__gqltype === 'Asset' || identity.isLSP7 === true ||
    !!identity.standard?.includes('LSP7') || !!identity.standard?.includes('LSP8') ||
    !!identity.lsp4TokenName
})

const receiverAssetName = computed(() => {
  const identity = toIdentity.value
  return identity?.lsp4TokenName || identity?.lsp4TokenSymbol || identity?.name || ''
})

const receiverIconUrl = computed(() => {
  const icons = toIdentity.value?.icons
  if (!icons?.length) return ''
  const sorted = [...(icons || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

const toProfileUrl = computed(() => {
  const images = toIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 32)
})

// ─── Token contract: from Transfer event (emitted by the actual token contract) ───
import { LIKES_CONTRACT as LIKES_TOKEN, FM_COLLECTION } from '../../lib/events'

const tokenContractAddress = computed(() => {
  const logs = props.tx.logs
  if (logs?.length) {
    // Transfer event is emitted by the token contract itself
    const transferLog = logs.find((l: any) => l.eventName === 'Transfer')
    if (transferLog?.address) return transferLog.address
    // Fallback: Executed event target (the contract the UP called)
    const executedLog = logs.find((l: any) => l.eventName === 'Executed')
    if (executedLog?.args) {
      const target = executedLog.args.find((a: any) => a.name === 'target')
      if (target?.value && typeof target.value === 'string') return target.value
    }
  }
  return props.tx.to
})

const tokenContractIdentity = computed(() => {
  if (transferType.value === 'lyx') return undefined
  return getIdentity(tokenContractAddress.value)
})

const tokenDecimals = computed(() => tokenContractIdentity.value?.decimals ?? 18)

const isLikesTransfer = computed(() =>
  tokenContractAddress.value?.toLowerCase() === LIKES_TOKEN ||
  tokenContractIdentity.value?.lsp4TokenSymbol?.toUpperCase() === 'LIKES'
)

// ─── Token type from the token contract being transferred ───
// lsp4TokenType: 0=Token (currency), 1=NFT, 2=Collection
// If 1 or 2, show as NFT card regardless of who the receiver is
const isNftToken = computed(() => {
  const tokenType = tokenContractIdentity.value?.lsp4TokenType
  return tokenType === 1 || tokenType === 2
})

// ─── NFT preview card: token is NFT type, or receiver is a Forever Moments NFT ───
// FM_COLLECTION imported from events.ts

const receiverIsForeverMoment = computed(() => {
  // Check via resolve API identity
  const identity = toIdentity.value
  if (identity?.lsp4TokenName === 'Forever Moments') return true
  // Check via Envio data
  if (envioCollectionName.value === 'Forever Moments') return true
  // Check if receiver address is the FM collection itself
  if (receiver.value?.toLowerCase() === FM_COLLECTION) return true
  return false
})

// "Liked with" = tokens sent to a Forever Moments NFT (not any random asset)
const isLikeAction = computed(() => {
  if (isBatchTransfer.value) return false
  if (isNftToken.value) return false // handled by isNftToken card above
  if (transferType.value !== 'lsp7' && transferType.value !== 'lyx') return false
  return receiverIsForeverMoment.value
})

// Fetch Envio data for receiver (determines if it's an asset + gets moment details)
let envioFetched = false
watch(() => receiver.value, (addr) => {
  if (addr && !envioFetched && !isBatchTransfer.value && (transferType.value === 'lsp7' || transferType.value === 'lyx')) {
    envioFetched = true
    fetchTokenName(addr).then(meta => {
      if (meta) {
        if (meta.name) envioMomentName.value = meta.name
        if (meta.lsp4TokenName) envioCollectionName.value = meta.lsp4TokenName
      }
    })
  }
}, { immediate: true })

// (NFT preview + creator + LIKES count handled by NftPreview / FmMomentPreview components)
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
    const sorted = [...(icons || [])].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
  }
  const images = identity?.profileImages
  if (images?.length) {
    const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
  }
  return ''
})

</script>
