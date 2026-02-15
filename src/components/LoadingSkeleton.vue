<template>
  <div class="space-y-3 p-4">
    <div v-for="i in count" :key="i" class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 space-y-3">
      <div class="flex items-center gap-3">
        <div class="skeleton w-8 h-8 rounded-full"></div>
        <div class="skeleton h-4 w-28"></div>
        <div class="skeleton h-4 w-20 ml-auto"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 6 })
</script>
