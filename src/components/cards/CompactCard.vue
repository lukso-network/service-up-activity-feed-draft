<template>
  <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 overflow-hidden max-w-full">
    <div class="flex items-center gap-3 min-w-0 overflow-hidden">
      <slot />
      <JsonExpandButton v-if="tx" @toggle="expanded = !expanded" />
    </div>
    <pre
      v-if="expanded && tx"
      class="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-72 overflow-y-auto font-mono leading-relaxed"
    >{{ JSON.stringify(tx, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import JsonExpandButton from '../shared/JsonExpandButton.vue'

defineProps<{
  tx?: Record<string, unknown>
}>()

const expanded = ref(false)
</script>
