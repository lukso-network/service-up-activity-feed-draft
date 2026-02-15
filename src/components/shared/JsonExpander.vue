<template>
  <div class="mt-2">
    <button
      @click="expanded = !expanded"
      class="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
    >
      <svg
        class="w-3.5 h-3.5 transition-transform"
        :class="{ 'rotate-90': expanded }"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        <text x="8" y="11.5" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">i</text>
      </svg>
      <span>{{ expanded ? 'Hide' : 'Details' }}</span>
    </button>
    <pre
      v-if="expanded"
      class="mt-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed"
    >{{ formattedJson }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  data: Record<string, unknown>
}>()

const expanded = ref(false)

const formattedJson = computed(() => {
  try {
    return JSON.stringify(props.data, null, 2)
  } catch {
    return String(props.data)
  }
})
</script>
