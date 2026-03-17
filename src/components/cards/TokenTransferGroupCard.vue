<template>
  <div class="bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(255,255,255,0.06)] p-4 overflow-hidden max-w-full">
    <!-- Header — clickable to expand -->
    <div class="flex gap-3 cursor-pointer" @click="toggleIfBackground($event)">
      <div class="flex items-center gap-3 min-w-0 flex-wrap flex-1">
        <!-- Sender profile badge -->
        <ProfileBadge
          :address="senderAddress"
          :name="senderIdentity?.name"
          :profile-url="senderProfileUrl"
          :is-e-o-a="senderIsEOA"
          :is-bot="senderIsBot"
          size="x-small"
        />

        <!-- Description -->
        <span class="text-sm text-neutral-700 dark:text-neutral-300">
          airdropped
          <span class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200">
            <img v-if="tokenIconUrl" :src="tokenIconUrl" :alt="tokenName" class="w-4 h-4 rounded-full" />
            <template v-if="isNft">{{ transactions.length }} {{ tokenName }} NFTs</template>
            <template v-else>{{ totalFormatted }} {{ tokenName }}</template>
          </span>
          to {{ recipientCount }} {{ recipientCount === 1 ? 'recipient' : 'recipients' }}
        </span>

        <!-- Stacked recipient icons -->
        <div class="flex items-center -space-x-1.5">
          <a
            v-for="addr in previewRecipients"
            :key="addr"
            :href="`https://universaleverything.io/${addr}`"
            target="_blank"
            rel="noopener noreferrer"
            class="block"
          >
            <lukso-profile
              v-if="addrIsEOA(addr)"
              :profile-url="getBlockie(addr)"
              size="x-small"
            ></lukso-profile>
            <lukso-profile
              v-else
              :profile-url="getProfileUrl(addr)"
              :profile-address="addr"
              has-identicon
              size="x-small"
            ></lukso-profile>
          </a>
          <span v-if="uniqueRecipients.length > 5" class="text-xs text-neutral-400 dark:text-neutral-500 ml-6 pl-2">
            +{{ uniqueRecipients.length - 5 }}
          </span>
        </div>

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

    <!-- NFT preview on main card (collapsed) -->
    <div v-if="isNft && firstTokenIdRaw" class="mt-3">
      <NftPreview :address="tokenContract" :chain-id="chainId" :token-id="firstTokenIdRaw" />
    </div>

    <!-- Expanded: compact recipient rows + TxDetails with arrow nav -->
    <div v-if="expanded" class="mt-3 border-t border-neutral-100 dark:border-neutral-850">
      <!-- Compact recipient grid -->
      <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div
          v-for="r in recipientRows"
          :key="r.address"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors min-w-0"
        >
          <ProfileBadge
            :address="r.address"
            :name="getIdentity(r.address)?.name"
            :profile-url="getProfileUrl(r.address)"
            :is-e-o-a="addrIsEOA(r.address)"
            :is-bot="addrIsBot(r.address)"
            size="x-small"
          />
          <span v-if="r.detail" class="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap flex-shrink-0">
            {{ r.detail }}
          </span>
        </div>
      </div>

      <!-- TxDetails with left/right arrow navigation -->
      <div class="mt-3 border-t border-neutral-100 dark:border-neutral-850 pt-3">
        <div class="flex items-center justify-between mb-2">
          <button
            @click.stop="currentTxIndex = Math.max(0, currentTxIndex - 1)"
            :disabled="currentTxIndex === 0"
            class="p-1 rounded transition-colors"
            :class="currentTxIndex === 0
              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {{ currentTxIndex + 1 }} / {{ transactions.length }}
          </span>
          <button
            @click.stop="currentTxIndex = Math.min(transactions.length - 1, currentTxIndex + 1)"
            :disabled="currentTxIndex === transactions.length - 1"
            class="p-1 rounded transition-colors"
            :class="currentTxIndex === transactions.length - 1
              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        <TxDetails :tx="(transactions[currentTxIndex] as any)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl, formatWhole } from '../../lib/formatters'
import { isEOA, isBot, makeBlockie } from '../../lib/eoa'
import { EXECUTED_EVENT, findLogByEvent } from '../../lib/events'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import NftPreview from '../shared/NftPreview.vue'
import TxDetails from '../shared/TxDetails.vue'

const props = defineProps<{
  transactions: Transaction[]
  chainId: number
  tokenContract: string
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const expanded = ref(false)
const currentTxIndex = ref(0)

// Raw tokenId from first transaction (for NFT preview on main card)
const firstTokenIdRaw = computed(() => {
  const tx = props.transactions[0]
  const argTokenId = tx?.args?.find(a => a.name === 'tokenId')
  if (argTokenId?.value) return String(argTokenId.value)
  return ''
})

// --- Helpers ---

function getSender(tx: Transaction): string {
  const fromArg = tx.args?.find(a => a.name === 'from')
  if (fromArg?.value && typeof fromArg.value === 'string') return fromArg.value.toLowerCase()
  const executed = findLogByEvent(tx.logs, EXECUTED_EVENT)
  if (executed?.address) return executed.address.toLowerCase()
  return tx.from.toLowerCase()
}

function getReceiver(tx: Transaction): string {
  const toArg = tx.args?.find(a => a.name === 'to')
  if (toArg?.value && typeof toArg.value === 'string') return toArg.value.toLowerCase()
  return (tx.to || '').toLowerCase()
}

// Sender is the shared sender across all grouped transactions (use the first)
const senderAddress = computed(() => getSender(props.transactions[0]))
const senderIdentity = computed(() => getIdentity(senderAddress.value))
const senderIsEOA = computed(() => isEOA(senderIdentity.value))
const senderIsBot = computed(() => isBot(senderIdentity.value))
const senderProfileUrl = computed(() => {
  const images = senderIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

// Token contract identity
const tokenContractIdentity = computed(() => getIdentity(props.tokenContract))

const tokenName = computed(() => {
  const id = tokenContractIdentity.value
  return id?.lsp4TokenSymbol || id?.lsp4TokenName || id?.name || 'Token'
})

const tokenIconUrl = computed(() => {
  const icons = tokenContractIdentity.value?.icons
  if (!icons?.length) return ''
  const sorted = [...icons].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 16)
})

const isNft = computed(() => {
  const id = tokenContractIdentity.value
  if (!id) {
    // Fallback: check transaction standard
    return props.transactions[0]?.standard?.toLowerCase().includes('lsp8') || false
  }
  return id.lsp4TokenType === 1 || id.lsp4TokenType === 2 ||
    !!id.standard?.includes('LSP8') || !!id.standard?.includes('IdentifiableDigitalAsset')
})

const tokenDecimals = computed(() => tokenContractIdentity.value?.decimals ?? 18)

// Unique recipients
const uniqueRecipients = computed(() => {
  const addrs = new Set<string>()
  for (const tx of props.transactions) {
    const receiver = getReceiver(tx)
    // receiver here is actually the token contract (tx.to), so use the 'to' arg instead
    const toArg = tx.args?.find(a => a.name === 'to')
    if (toArg?.value && typeof toArg.value === 'string') {
      addrs.add(toArg.value.toLowerCase())
    } else if (receiver && receiver !== props.tokenContract.toLowerCase()) {
      addrs.add(receiver)
    }
  }
  return [...addrs]
})

const recipientCount = computed(() => uniqueRecipients.value.length)
const previewRecipients = computed(() => uniqueRecipients.value.slice(0, 5))

// Detailed recipient rows for expanded view
const recipientRows = computed(() => {
  // Build a map: recipient address → detail (amount for LSP7, tokenId for LSP8)
  const rows: Array<{ address: string; detail: string }> = []
  const seen = new Set<string>()
  for (const tx of props.transactions) {
    const toArg = tx.args?.find(a => a.name === 'to')
    const addr = (toArg?.value && typeof toArg.value === 'string')
      ? toArg.value.toLowerCase()
      : ''
    if (!addr || seen.has(addr)) continue
    seen.add(addr)
    let detail = ''
    if (isNft.value) {
      const tokenIdArg = tx.args?.find(a => a.name === 'tokenId')
      if (tokenIdArg?.value) {
        const idStr = String(tokenIdArg.value)
        // For NUMBER format, show #N
        try {
          const n = BigInt(idStr)
          if (n < 100000n) detail = `#${n}`
          else detail = `${idStr.slice(0, 6)}…`
        } catch {
          detail = idStr.length > 10 ? `${idStr.slice(0, 6)}…` : idStr
        }
      }
    } else {
      const amountArg = tx.args?.find(a => a.name === 'amount')
      if (amountArg?.value != null) {
        try {
          const val = BigInt(String(amountArg.value))
          const dec = BigInt(tokenDecimals.value)
          if (dec === 0n) {
            detail = Number(val).toLocaleString('en-US')
          } else {
            const divisor = 10n ** dec
            const whole = val / divisor
            const frac = val % divisor
            if (frac === 0n) {
              detail = Number(whole).toLocaleString('en-US')
            } else {
              const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 2)
              detail = `${Number(whole).toLocaleString('en-US')}.${fracStr}`
            }
          }
          detail += ` ${tokenName.value}`
        } catch { /* skip */ }
      }
    }
    rows.push({ address: addr, detail })
  }
  return rows
})

// Total token amount across all transactions (for LSP7)
const totalFormatted = computed(() => {
  if (isNft.value) return ''
  try {
    let total = 0n
    for (const tx of props.transactions) {
      const amountArg = tx.args?.find(a => a.name === 'amount')
      if (amountArg?.value != null) {
        total += BigInt(String(amountArg.value))
      }
    }
    const dec = BigInt(tokenDecimals.value)
    if (dec === 0n) {
      const s = total.toString()
      if (s.length > 12) return `${s[0]}.${s.slice(1, 4)}e${s.length - 1}`
      return Number(total).toLocaleString('en-US')
    }
    const divisor = 10n ** dec
    const whole = total / divisor
    const frac = total % divisor
    if (frac === 0n) return formatWhole(whole)
    const fracStr = frac.toString().padStart(Number(dec), '0').replace(/0+$/, '').slice(0, 4)
    return `${formatWhole(whole)}.${fracStr}`
  } catch {
    return ''
  }
})

// Queue address resolution
watchEffect(() => {
  const addrs = new Set<string>()
  addrs.add(props.tokenContract)
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

function addrIsEOA(address: string): boolean {
  return isEOA(getIdentity(address))
}

function addrIsBot(address: string): boolean {
  return isBot(getIdentity(address))
}

function getBlockie(address: string): string {
  return makeBlockie(address)
}

function getProfileUrl(address: string): string {
  const identity = getIdentity(address)
  const images = identity?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
}

function toggleIfBackground(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('a, button, lukso-username, lukso-profile, input, select')) return
  expanded.value = !expanded.value
}
</script>


