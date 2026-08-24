import { createRouter, createWebHistory } from 'vue-router'
import ActivityFeed from '../views/ActivityFeed.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:chainId(\\d+)/:address(0x[a-fA-F0-9]{40})',
      name: 'activity',
      // Temporary safety valve: profile queries currently fall back to casting and
      // scanning decoded JSON. Remove this redirect after the profile joins have
      // been repaired/backfilled and profile feeds use indexed relations only.
      redirect: (to) => ({
        name: 'global-activity',
        params: { chainId: to.params.chainId },
        query: to.query,
      }),
    },
    {
      // Address only — default to LUKSO mainnet (chainId 42)
      path: '/:address(0x[a-fA-F0-9]{40})',
      name: 'activity-address',
      redirect: (to) => ({
        name: 'global-activity',
        params: { chainId: '42' },
        query: to.query,
      }),
    },
    {
      path: '/:chainId(\\d+)',
      name: 'global-activity',
      component: ActivityFeed,
    },
    {
      path: '/',
      name: 'home',
      component: ActivityFeed,
    },
  ],
})

// Migrate old hash-based profile URLs directly to the chain's global feed while
// profile-specific feeds are temporarily disabled.
router.beforeEach((to, _from, next) => {
  if (to.hash && to.hash.length > 1) {
    // e.g. hash = "#42/0x..." or "#/42/0x..."
    let hashPath = to.hash.slice(1) // remove #
    if (hashPath.startsWith('/')) hashPath = hashPath.slice(1)
    const chainProfileMatch = hashPath.match(/^(\d+)\/0x[a-fA-F0-9]{40}$/)
    if (chainProfileMatch) {
      return next({
        name: 'global-activity',
        params: { chainId: chainProfileMatch[1] },
        query: to.query,
      })
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(hashPath)) {
      return next({
        name: 'global-activity',
        params: { chainId: '42' },
        query: to.query,
      })
    }
  }
  next()
})

export default router
