import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useDarkMode() {
  const route = useRoute()
  const isDark = computed(() => {
    const dm = route.query.darkmode
    return dm === 'true' || dm === '1'
  })
  return { isDark }
}
