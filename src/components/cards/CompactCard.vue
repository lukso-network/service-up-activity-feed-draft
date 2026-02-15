<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 overflow-hidden max-w-full">
    <div class="flex items-center gap-3 min-w-0 overflow-hidden">
      <slot />
    </div>
    <JsonExpander v-if="tx" :data="tx" />
  </div>
</template>

<script setup lang="ts">
import JsonExpander from '../shared/JsonExpander.vue'

defineProps<{
  tx?: Record<string, unknown>
}>()
</script>
