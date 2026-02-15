import { createRouter, createWebHistory } from 'vue-router'
import ActivityFeed from '../views/ActivityFeed.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:chainId/:address',
      name: 'activity',
      component: ActivityFeed,
    },
    {
      // Address only — default to LUKSO mainnet (chainId 42)
      path: '/:address(0x[a-fA-F0-9]{40})',
      name: 'activity-address',
      component: ActivityFeed,
      beforeEnter: (to, _from, next) => {
        next(`/42/${to.params.address}`)
      },
    },
    {
      path: '/:chainId',
      name: 'global-activity',
      component: ActivityFeed,
    },
    {
      path: '/',
      redirect: '/42',
    },
  ],
})

export default router
