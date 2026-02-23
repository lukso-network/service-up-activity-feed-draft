import { ref, onUnmounted } from 'vue'

const now = ref(Date.now())
let intervalId: ReturnType<typeof setInterval> | null = null
let subscribers = 0

/**
 * Shared reactive `now` timestamp that ticks every 5 minutes.
 * All TimeStamp instances share a single interval via ref-counting.
 */
export function useNow() {
  if (subscribers === 0) {
    intervalId = setInterval(() => {
      now.value = Date.now()
    }, 300_000)
  }
  subscribers++

  onUnmounted(() => {
    subscribers--
    if (subscribers === 0 && intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  })

  return now
}
