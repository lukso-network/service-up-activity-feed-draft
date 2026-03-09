<template>
  <router-view />
</template>

<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Dark mode: toggle via ?darkmode=true query parameter
watchEffect(() => {
  const darkmode = route.query.darkmode
  if (darkmode === 'true' || darkmode === '1') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})
</script>
