import { createRouter, createWebHistory } from 'vue-router'
import ActivityFeed from '../views/ActivityFeed.vue'
import { DEFAULT_CHAIN_ID } from '../lib/chains'

const PROFILE_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:chainId(\\d+)/:address(0x[a-fA-F0-9]{40})',
      name: 'activity',
      component: ActivityFeed,
    },
    {
      // Address only — default to LUKSO mainnet (chainId 42)
      path: '/:address(0x[a-fA-F0-9]{40})',
      name: 'activity-address',
      redirect: (to) => ({
        name: 'activity',
        params: { chainId: String(DEFAULT_CHAIN_ID), address: to.params.address },
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

// Migrate old hash-based URLs (/#/42/0x...) to history mode (/42/0x...)
router.beforeEach((to, _from, next) => {
  if (to.hash && to.hash.length > 1) {
    // e.g. hash = "#42/0x..." or "#/42/0x..."
    let hashPath = to.hash.slice(1) // remove #
    if (hashPath.startsWith('/')) hashPath = hashPath.slice(1)
    const chainProfileMatch = hashPath.match(/^(\d+)\/(0x[a-fA-F0-9]{40})$/)
    if (chainProfileMatch) {
      return next({
        name: 'activity',
        params: { chainId: chainProfileMatch[1], address: chainProfileMatch[2] },
        query: to.query,
      })
    }
    if (PROFILE_ADDRESS_PATTERN.test(hashPath)) {
      return next({
        name: 'activity',
        params: { chainId: String(DEFAULT_CHAIN_ID), address: hashPath },
        query: to.query,
      })
    }
  }
  next()
})

export default router
