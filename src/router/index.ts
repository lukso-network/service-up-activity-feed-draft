import { createRouter, createWebHistory } from 'vue-router'
import ActivityFeed from '../views/ActivityFeed.vue'

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
      redirect: (to) => `/42/${to.params.address}`,
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
    if (/^\d+\/0x[a-fA-F0-9]{40}$/.test(hashPath)) {
      return next('/' + hashPath)
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(hashPath)) {
      return next('/42/' + hashPath)
    }
  }
  next()
})

export default router
