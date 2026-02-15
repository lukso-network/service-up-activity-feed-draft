<template>
  <div class="space-y-4 p-4">
    <div v-for="i in count" :key="i" class="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="skeleton w-10 h-10 rounded-full"></div>
          <div class="space-y-2">
            <div class="skeleton h-4 w-32"></div>
            <div class="skeleton h-3 w-20"></div>
          </div>
        </div>
        <div class="skeleton h-3 w-16"></div>
      </div>
      <div class="skeleton h-4 w-48"></div>
      <div class="flex items-center gap-2">
        <div class="skeleton h-6 w-24 rounded-full"></div>
        <div class="skeleton h-6 w-16 rounded-full"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 5 })
</script>
