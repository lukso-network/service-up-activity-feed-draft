<template>
  <a
    :href="`https://universaleverything.io/${address}`"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-start gap-2 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
  >
    <ProfileAvatar
      :address="address"
      :profile-url="profileUrl"
      :is-e-o-a="isEOA"
      :size="size"
    />
    <span
      v-if="name && !isEOA"
      class="min-w-0 max-w-full"
      :class="nameHashWrapperClass"
    >
      <span
        class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-baseline font-semibold leading-tight text-neutral-800 dark:text-neutral-200"
        :class="textSizeClass"
      >@{{ name }}</span>
      <span
        class="whitespace-nowrap leading-none text-neutral-500"
        :class="[hashSizeClass, hashPlacementClass]"
        :style="{ color: addressColor }"
      >#{{ address.slice(2, 6) }}</span>
    </span>
    <span
      v-else
      class="truncate font-mono text-neutral-500"
      :class="textSizeClass"
      :style="{ color: addressColor }"
    >{{ shortenAddress(address) }}</span>
    <BotBadge v-if="isBot" />
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { shortenAddress } from '../../lib/formatters'
import BotBadge from './BotBadge.vue'
import ProfileAvatar from './ProfileAvatar.vue'

const { isDark } = useDarkMode()

const sizeSteps = ['x-small', 'small', 'medium', 'large'] as const

const props = defineProps<{
  address: string
  name?: string
  profileUrl?: string
  size?: string
  isEOA?: boolean
  isBot?: boolean
}>()

const nextSize = computed(() => {
  const cur = props.size || 'x-small'
  const idx = sizeSteps.indexOf(cur as any)
  const bump = Math.min(idx + 2, sizeSteps.length - 1)
  return idx >= 0 ? sizeSteps[bump] : cur
})

const addressColor = computed(() => isDark.value ? '#9cb6c9' : undefined)

const textSizeClass = computed(() => {
  switch (nextSize.value) {
    case 'x-small': return 'text-xs'
    case 'small': return 'text-sm'
    case 'medium': return 'text-sm'
    case 'large': return 'text-base'
    default: return 'text-sm'
  }
})

const shouldStackHash = computed(() => (props.name?.length ?? 0) > 10)

const nameHashWrapperClass = computed(() => shouldStackHash.value
  ? 'flex flex-col items-start'
  : 'inline-flex flex-wrap items-baseline gap-x-1'
)

const hashPlacementClass = computed(() => shouldStackHash.value
  ? 'block -mt-0.5'
  : 'inline-block shrink-0'
)

const hashSizeClass = computed(() => {
  return nextSize.value === 'large' ? 'text-sm' : 'text-xs'
})
</script>
