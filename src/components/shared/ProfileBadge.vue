<template>
  <div class="flex items-center gap-2 min-w-0">
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
  </div>
</template>

<script setup lang="ts">
defineProps<{
  address: string
  name?: string
  profileUrl?: string
  size?: string
}>()
</script>
