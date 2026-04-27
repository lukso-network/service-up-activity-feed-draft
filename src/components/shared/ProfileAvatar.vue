<template>
  <lukso-profile
    v-if="isEOA"
    :profile-url="blockieUrl"
    :size="size"
  ></lukso-profile>
  <lukso-profile
    v-else
    :profile-url="profileUrl || ''"
    :profile-address="address"
    has-identicon
    :size="size"
  ></lukso-profile>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { makeBlockie } from '../../lib/eoa'

const props = defineProps<{
  address: string
  profileUrl?: string
  size?: string
  isEOA?: boolean
}>()

const blockieUrl = computed(() =>
  props.isEOA && props.address ? makeBlockie(props.address) : ''
)
</script>
