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
      <FmMomentPreview v-if="momentAddress" :address="momentAddress" :chain-id="chainId" />
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
import { optimizeImageUrl } from '../../lib/formatters'
import { fetchFMomentByBlock } from '../../lib/api'
import ExtendedCard from './ExtendedCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'
import FmMomentPreview from '../shared/FmMomentPreview.vue'

const FM_COLLECTION = '0xef54710b5a78b4926104a65594539521eb440d37'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const actorAddress = computed(() => props.tx.from)
const actorIdentity = computed(() => getIdentity(actorAddress.value))
const actorProfileUrl = computed(() => {
  const images = actorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})

const momentAddress = ref<string>('')
const loading = ref(true)

onMounted(async () => {
  try {
    const blockNum = parseInt(String(props.tx.blockNumber).replace('n', ''))
    const found = await fetchFMomentByBlock(FM_COLLECTION, blockNum)
    if (found) {
      momentAddress.value = found.asset_id
      // Queue resolution so FmMomentPreview can use it
      queueResolve(props.chainId, [found.asset_id])
    }
  } catch {
    // Silently fail
  } finally {
    loading.value = false
  }
})
</script>
