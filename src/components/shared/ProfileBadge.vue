<template>
  <a
    :href="`https://universaleverything.io/${address}`"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
  >
    <ProfileAvatar
      :address="address"
      :profile-url="profileUrl"
      :is-e-o-a="isEOA"
      :size="size"
    />
    <lukso-username
      :name="name || ''"
      :address="address"
      prefix="@"
      :size="nextSize"
      :address-color="isDark ? '#9cb6c9' : ''"
    ></lukso-username>
    <BotBadge v-if="isBot" />
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
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
</script>
