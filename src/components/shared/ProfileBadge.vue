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
      :size="size"
    ></lukso-username>
  </a>
</template>

<script setup lang="ts">
defineProps<{
  address: string
  name?: string
  profileUrl?: string
  size?: string
}>()
</script>
