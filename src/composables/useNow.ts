import { ref, onUnmounted } from 'vue'

const now = ref(Date.now())
let intervalId: ReturnType<typeof setInterval> | null = null
let subscribers = 0

// 30 s keeps "just now" → "1 min ago" accurate while the feed updates live.
const TICK_MS = 30_000

function tick() {
  now.value = Date.now()
}

// Catch up immediately when the page becomes visible again: browsers throttle
// timers in background tabs.
function onVisibilityChange() {
  if (!document.hidden) tick()
}

/**
 * Shared reactive `now` timestamp that ticks every 30 seconds.
 * All TimeStamp instances share a single interval via ref-counting.
 */
export function useNow() {
  if (subscribers === 0) {
    tick()
    intervalId = setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  subscribers++

  onUnmounted(() => {
    subscribers--
    if (subscribers === 0 && intervalId) {
      clearInterval(intervalId)
      intervalId = null
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return now
}
