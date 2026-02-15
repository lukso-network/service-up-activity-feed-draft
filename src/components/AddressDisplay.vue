<template>
  <span class="inline-flex items-center gap-1.5 min-w-0">
    <img
      v-if="avatarSrc"
      :src="avatarSrc"
      :alt="displayName"
      class="w-5 h-5 rounded-full object-cover flex-shrink-0"
    />
    <span
      class="truncate text-sm"
      :class="isSelf
        ? 'font-semibold text-gray-900 dark:text-white'
        : 'text-gray-600 dark:text-gray-300'"
    >
      {{ displayName }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAddressResolver } from '../composables/useAddressResolver'
import { shortenAddress } from '../lib/formatters'

const props = defineProps<{
  address: string
  chainId: number
  isSelf?: boolean
}>()

const { getIdentity } = useAddressResolver()

const identity = computed(() => getIdentity(props.address))

const displayName = computed(() => {
  if (props.isSelf) return 'You'
  return identity.value?.name || shortenAddress(props.address)
})

const avatarSrc = computed(() => {
  if (props.isSelf) return null
  const images = identity.value?.profileImages
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return (sorted.find(i => i.width >= 32) || sorted[0]).src
})
</script>
