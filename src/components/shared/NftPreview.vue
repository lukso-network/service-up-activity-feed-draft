<template>
  <a
    :href="assetUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-start gap-4 hover:opacity-90 transition-opacity no-underline"
  >
    <!-- NFT image card -->
    <div class="flex-shrink-0 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      <div class="relative">
        <video
          v-if="videoUrl"
          ref="videoRef"
          :src="videoUrl"
          class="w-[140px] h-[140px] object-cover"
          autoplay
          muted
          loop
          playsinline
          preload="metadata"
        />
        <img
          v-else-if="effectiveImageUrl"
          :src="effectiveImageUrl"
          class="w-[140px] h-[140px] object-cover"
          :alt="displayName"
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
        <span class="text-xs text-neutral-500 font-mono">{{ tokenIdLabel || shortenAddress(address) }}</span>
      </div>
    </div>
    <!-- NFT details -->
    <div class="flex flex-col gap-1.5 min-w-0 py-1">
      <span class="text-lg font-bold text-neutral-800 dark:text-neutral-200 truncate">
        {{ displayName }}
      </span>
      <span v-if="subtitle" class="text-sm text-neutral-400 dark:text-neutral-500 truncate">
        {{ subtitle }}
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
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { shortenAddress, optimizeImageUrl } from '../../lib/formatters'
import { fetchTokenIdMetadata, type TokenAsset } from '../../lib/api'
import { detectMediaType, stripQueryParams } from '../../lib/mediaType'
import ProfileBadge from './ProfileBadge.vue'

const props = defineProps<{
  address: string
  chainId: number
  tokenIdLabel?: string
  tokenId?: string // raw bytes32 tokenId for per-token metadata lookup
}>()

const { getIdentity, queueResolve } = useAddressResolver()

const identity = computed(() => getIdentity(props.address))

const assetUrl = computed(() => {
  if (props.tokenId) {
    return `https://universaleverything.io/asset/${props.address}/tokenId/${props.tokenId}`
  }
  return `https://universaleverything.io/asset/${props.address}`
})

const displayName = computed(() =>
  tokenMeta.value?.name || identity.value?.lsp4TokenName || identity.value?.name || identity.value?.lsp4TokenSymbol || 'NFT'
)

// Subtitle: show token symbol if different from display name
const subtitle = computed(() => {
  const symbol = identity.value?.lsp4TokenSymbol
  if (symbol && symbol !== displayName.value) return symbol
  return ''
})

// Per-token metadata from Envio (for LSP8 individual token images)
const tokenMeta = ref<{ images: Array<{ src: string; width: number | null; height: number | null }>; icons: Array<{ src: string; width: number | null; height: number | null }>; name: string | null; assetId: string | null; assets: TokenAsset[] } | null>(null)
const tokenMetaLoading = ref(false)

watch(() => [props.address, props.tokenId] as const, ([addr, tid]) => {
  tokenMeta.value = null
  if (addr && tid) {
    tokenMetaLoading.value = true
    fetchTokenIdMetadata(addr, tid).then(meta => {
      if (meta) tokenMeta.value = meta
    }).finally(() => {
      tokenMetaLoading.value = false
    })
  }
}, { immediate: true })

function pickImage(
  images: Array<{ src: string; width: number | null; height: number | null }> | undefined,
  minWidth: number,
  renderWidth: number
): string {
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  const pick = sorted.find(i => (i.width ?? 0) >= minWidth) || sorted[sorted.length - 1]
  return optimizeImageUrl(pick.src, renderWidth)
}

const imageUrl = computed(() => {
  // If we're waiting for per-token metadata, don't show the collection image
  if (tokenMetaLoading.value) return ''

  // Prefer per-token images (from Envio) over collection-level images
  const tm = tokenMeta.value
  if (tm) {
    const fromTokenImages = pickImage(tm.images, 120, 140)
    if (fromTokenImages) return fromTokenImages
    const fromTokenIcons = pickImage(tm.icons, 120, 140)
    if (fromTokenIcons) return fromTokenIcons
  }
  // Fallback to collection-level images from resolve API
  const fromImages = pickImage(identity.value?.images, 120, 140)
  if (fromImages) return fromImages
  return pickImage(identity.value?.icons, 120, 140)
})

// Detected media type for identity images (via HEAD request)
const detectedVideoUrl = ref('')
const checkedImages = new Set<string>()

// When identity/tokenMeta resolves, check if any "images" are actually videos
watch([
  () => identity.value?.images?.length,
  () => tokenMeta.value?.assets?.length,
  () => tokenMeta.value?.images?.length,
], async () => {
  if (detectedVideoUrl.value) return // Already found
  // Check tokenMeta assets first (explicit fileType)
  const assets = tokenMeta.value?.assets
  if (assets?.length) {
    const video = assets.find(a => a.fileType?.startsWith('video/'))
    if (video?.src) {
      detectedVideoUrl.value = stripQueryParams(video.src)
      return
    }
  }
  // Then check all images via HEAD
  const images = [...(tokenMeta.value?.images || []), ...(identity.value?.images || [])]
  for (const img of images) {
    const src = (img as any).src
    if (!src || checkedImages.has(src)) continue
    checkedImages.add(src)
    const type = await detectMediaType(src)
    if (type === 'video') {
      detectedVideoUrl.value = stripQueryParams(src)
      return
    }
  }
}, { immediate: true })

const videoUrl = computed(() => detectedVideoUrl.value)

// Only show image if it's not actually a video
const effectiveImageUrl = computed(() => {
  if (videoUrl.value) return ''
  return imageUrl.value
})

const videoRef = ref<HTMLVideoElement | null>(null)
let observer: IntersectionObserver | null = null

watch(videoRef, (el) => {
  observer?.disconnect()
  if (!el) return
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  })
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
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
  const sorted = [...(images || [])].sort((a, b) => a.width - b.width)
  return optimizeImageUrl((sorted.find(i => i.width >= 32) || sorted[0]).src, 24)
})
</script>
