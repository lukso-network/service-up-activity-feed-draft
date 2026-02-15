<template>
  <a
    :href="momentUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-start gap-4 hover:opacity-90 transition-opacity no-underline"
  >
    <!-- Moment image card -->
    <div class="flex-shrink-0 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      <div class="relative">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          class="w-[140px] h-[140px] object-cover"
          :alt="momentName"
          loading="lazy"
        />
        <div v-else class="w-[140px] h-[140px] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <lukso-profile
            :profile-address="address"
            has-identicon
            size="x-large"
          ></lukso-profile>
        </div>
      </div>
      <div class="px-2 py-1.5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
        <span class="text-xs text-neutral-500 font-mono">{{ shortenAddress(address) }}</span>
      </div>
    </div>
    <!-- Moment details -->
    <div class="flex flex-col gap-1.5 min-w-0 py-1">
      <span v-if="collectionName" class="text-sm text-neutral-500 dark:text-neutral-400 truncate">
        {{ collectionName }}
      </span>
      <span class="text-lg font-bold text-neutral-800 dark:text-neutral-200 truncate">
        {{ momentName }}
      </span>
      <!-- Creator -->
      <div v-if="creatorAddress" class="mt-1">
        <span class="text-xs text-neutral-400 dark:text-neutral-500">Created by</span>
        <div class="mt-1">
          <ProfileBadge
            :address="creatorAddress"
            :name="creatorIdentity?.name"
            :profile-url="creatorProfileUrl"
            size="x-small"
          />
        </div>
      </div>
      <span v-else class="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
        {{ shortenAddress(address) }}
      </span>
      <!-- LIKES count -->
      <div v-if="likesCount && likesCount !== '0'" class="mt-2">
        <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">{{ likesCount }} LIKES</span>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { shortenAddress, optimizeImageUrl } from '../../lib/formatters'
import { fetchLikesBalance, fetchTokenName } from '../../lib/api'
import ProfileBadge from './ProfileBadge.vue'

const props = defineProps<{
  address: string
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const identity = computed(() => getIdentity(props.address))

// Envio data (individual moment name + collection name)
const envioMomentName = ref<string | null>(null)
const envioCollectionName = ref<string | null>(null)
const likesCount = ref<string | null>(null)

let fetched = false
watch(() => props.address, (addr) => {
  if (addr && !fetched) {
    fetched = true
    fetchTokenName(addr).then(meta => {
      if (meta) {
        if (meta.name) envioMomentName.value = meta.name
        if (meta.lsp4TokenName) envioCollectionName.value = meta.lsp4TokenName
      }
    })
    fetchLikesBalance(addr).then(count => {
      if (count) likesCount.value = count
    })
  }
}, { immediate: true })

const momentUrl = computed(() => `https://www.forevermoments.life/moments/${props.address}`)

const momentName = computed(() =>
  identity.value?.name || envioMomentName.value || 'Untitled Moment'
)

const collectionName = computed(() => {
  const collection = identity.value?.lsp4TokenName || envioCollectionName.value || ''
  const name = momentName.value
  // Don't show collection name if same as moment name
  return (collection && name && collection !== name) ? collection : ''
})

const imageUrl = computed(() => {
  const images = identity.value?.images
  if (images?.length) {
    const sorted = [...images].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 120) || sorted[sorted.length - 1]).src, 140)
  }
  const icons = identity.value?.icons
  if (icons?.length) {
    const sorted = [...icons].sort((a, b) => a.width - b.width)
    return optimizeImageUrl((sorted.find(i => i.width >= 120) || sorted[sorted.length - 1]).src, 140)
  }
  return ''
})

// Creator from lsp4Creators or owner_id
const creatorAddress = computed(() => {
  const creators = (identity.value as any)?.lsp4Creators
  if (creators?.length) return creators[0].profile_id || creators[0].address || ''
  return identity.value?.owner_id || ''
})

const creatorIdentity = computed(() => {
  const addr = creatorAddress.value
  if (!addr) return undefined
  const id = getIdentity(addr)
  if (!id) queueResolve(props.chainId, [addr])
  return id
})

const creatorProfileUrl = computed(() => {
  const images = creatorIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})
</script>
