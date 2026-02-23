<template>
  <span class="text-xs text-neutral-400 whitespace-nowrap">{{ display }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatRelativeTime, formatFullTime } from '../../lib/formatters'
import { useNow } from '../../composables/useNow'

const props = defineProps<{
  timestamp: number
  format?: 'relative' | 'full'
}>()

const now = useNow()

const display = computed(() =>
  props.format === 'full'
    ? formatFullTime(props.timestamp)
    : formatRelativeTime(props.timestamp, now.value)
)
</script>
