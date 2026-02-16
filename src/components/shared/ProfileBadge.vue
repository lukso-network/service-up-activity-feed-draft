<template>
  <a
    :href="`https://universaleverything.io/${address}`"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity cursor-pointer no-underline"
  >
    <lukso-profile
      :profile-url="profileUrl || ''"
      :profile-address="address"
      has-identicon
      :size="size"
    ></lukso-profile>
    <lukso-username
      :name="name || ''"
      :address="address"
      prefix="@"
      :size="nextSize"
    ></lukso-username>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const sizeSteps = ['x-small', 'small', 'medium', 'large'] as const

const props = defineProps<{
  address: string
  name?: string
  profileUrl?: string
  size?: string
}>()

const nextSize = computed(() => {
  const cur = props.size || 'x-small'
  const idx = sizeSteps.indexOf(cur as any)
  const bump = Math.min(idx + 2, sizeSteps.length - 1)
  return idx >= 0 ? sizeSteps[bump] : cur
})
</script>
