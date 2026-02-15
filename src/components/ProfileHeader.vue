<template>
  <div v-if="profile" class="relative overflow-hidden">
    <!-- Background image -->
    <div class="h-28 bg-gradient-to-r from-lukso-pink/20 to-purple-500/20 dark:from-lukso-pink/10 dark:to-purple-500/10">
      <img
        v-if="backgroundSrc"
        :src="backgroundSrc"
        alt=""
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Profile info using web components -->
    <div class="px-4 pb-4">
      <div class="flex items-end gap-3 -mt-8">
        <lukso-profile
          :profile-url="avatarSrc || ''"
          :profile-address="address"
          has-identicon
          size="large"
        ></lukso-profile>
        <div class="pb-1 min-w-0">
          <lukso-username
            :name="profile.name || ''"
            :address="address"
            prefix="@"
            size="medium"
          ></lukso-username>
        </div>
      </div>
      <p v-if="profile.description" class="mt-2 text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2">
        {{ profile.description }}
      </p>
    </div>
  </div>

  <!-- Skeleton -->
  <div v-else-if="loading" class="relative">
    <div class="h-28 skeleton"></div>
    <div class="px-4 pb-4">
      <div class="flex items-end gap-3 -mt-8">
        <div class="w-16 h-16 rounded-full skeleton border-4 border-white dark:border-lukso-dark"></div>
        <div class="pb-1 space-y-2">
          <div class="skeleton h-5 w-32"></div>
          <div class="skeleton h-3 w-24"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AddressIdentity } from '../lib/types'

const props = defineProps<{
  profile: AddressIdentity | undefined
  address: string
  loading: boolean
}>()

const avatarSrc = computed(() => {
  const images = props.profile?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return (sorted.find(i => i.width >= 64) || sorted[0]).src
})

const backgroundSrc = computed(() => {
  const images = props.profile?.backgroundImages
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => a.width - b.width)
  return (sorted.find(i => i.width >= 320) || sorted[sorted.length - 1]).src
})
</script>
