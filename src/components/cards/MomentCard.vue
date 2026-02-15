<template>
  <ExtendedCard :tx="(tx as any)">
    <template #header>
      <ProfileBadge
        :address="actorAddress"
        :name="actorIdentity?.name"
        :profile-url="actorProfileUrl"
        size="x-small"
      />
      <span class="text-sm text-neutral-500 dark:text-neutral-400">created a new moment</span>
      <span class="text-base">📸</span>
      <TimeStamp :timestamp="tx.blockTimestamp" />
    </template>
    <template #content>
      <a
        v-if="moment"
        :href="momentUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-start gap-4 hover:opacity-90 transition-opacity no-underline"
      >
        <!-- Moment image -->
        <div class="flex-shrink-0 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
          <div class="relative">
            <img
              v-if="momentImageUrl"
              :src="momentImageUrl"
              class="w-[140px] h-[140px] object-cover"
              :alt="moment.name"
              loading="lazy"
            />
            <div v-else class="w-[140px] h-[140px] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <lukso-profile
                :profile-address="moment.asset_id"
                has-identicon
                size="x-large"
              ></lukso-profile>
            </div>
          </div>
          <div class="px-2 py-1.5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
            <span class="text-xs text-neutral-500 font-mono">{{ shortenAddress(moment.asset_id) }}</span>
          </div>
        </div>
        <!-- Moment details -->
        <div class="flex flex-col gap-1.5 min-w-0 py-1">
          <span v-if="moment.lsp4TokenName" class="text-sm text-neutral-500 dark:text-neutral-400 truncate">
            {{ moment.lsp4TokenName }}
          </span>
          <span class="text-lg font-bold text-neutral-800 dark:text-neutral-200 truncate">
            {{ moment.name || 'Untitled Moment' }}
          </span>
          <!-- Creator -->
          <div class="mt-1">
            <span class="text-xs text-neutral-400 dark:text-neutral-500">Created by</span>
            <div class="mt-1">
              <ProfileBadge
                :address="actorAddress"
                :name="actorIdentity?.name"
                :profile-url="actorProfileUrl"
                size="x-small"
              />
            </div>
          </div>
        </div>
      </a>
      <!-- Loading state -->
      <div v-else-if="loading" class="flex items-center gap-2 text-sm text-neutral-400">
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading moment...
      </div>
      <!-- Fallback -->
      <div v-else class="text-sm text-neutral-500">
        Created a new Forever Moment
      </div>
    </template>
  </ExtendedCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { optimizeImageUrl, shortenAddress } from '../../lib/formatters'
import { fetchFMomentByBlock, resolveAddresses } from '../../lib/api'
import ExtendedCard from './ExtendedCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const FM_COLLECTION = '0xef54710b5a78b4926104a65594539521eb440d37'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

// The actor is the UP (tx.from), since the API unwraps execute() calls
const actorAddress = computed(() => props.tx.from)
const actorIdentity = computed(() => getIdentity(actorAddress.value))
const actorProfileUrl = computed(() => {
  const images = actorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

interface MomentInfo {
  asset_id: string
  name: string
  lsp4TokenName: string
}

const moment = ref<MomentInfo | null>(null)
const loading = ref(true)
const momentImageUrl = ref('')

const momentUrl = computed(() => {
  if (!moment.value) return '#'
  return `https://universaleverything.io/asset/${moment.value.asset_id}`
})

onMounted(async () => {
  try {
    // Match moment by block number
    const blockNum = parseInt(String(props.tx.blockNumber).replace('n', ''))
    const found = await fetchFMomentByBlock(FM_COLLECTION, blockNum)
    moment.value = found
    
    if (found) {
      // Resolve the moment asset to get its image
      queueResolve(props.chainId, [found.asset_id])
      
      // Also try to get image from resolve API
      try {
        const res = await resolveAddresses(props.chainId, [found.asset_id])
        const identity = res.addressIdentities[found.asset_id.toLowerCase()]
        if (identity) {
          // Get images
          const images = identity.images
          if (images?.length) {
            const sorted = [...images].sort((a: any, b: any) => (a.width || 0) - (b.width || 0))
            const src = (sorted.find((i: any) => (i.width || 0) >= 140) || sorted[0]).src
            momentImageUrl.value = optimizeImageUrl(src, 140)
          }
          // Fallback to icons
          if (!momentImageUrl.value && identity.icons?.length) {
            momentImageUrl.value = optimizeImageUrl(identity.icons[0].src, 140)
          }
        }
      } catch {
        // Image loading is optional
      }
    }
  } catch {
    // Silently fail
  } finally {
    loading.value = false
  }
})
</script>
