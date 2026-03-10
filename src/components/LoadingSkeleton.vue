<template>
  <div class="space-y-3 p-4">
    <div v-for="i in count" :key="i" class="bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(255,255,255,0.06)] dark:border-y dark:border-y-neutral-700 p-4 space-y-3">
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
