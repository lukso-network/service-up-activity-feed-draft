import { createRouter, createWebHashHistory } from 'vue-router'
import ActivityFeed from '../views/ActivityFeed.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:chainId/:address',
      name: 'activity',
      component: ActivityFeed,
    },
    {
      path: '/:chainId',
      name: 'global-activity',
      component: ActivityFeed,
    },
    {
      path: '/',
      redirect: '/42/0xcdec110f9c255357e37f46cd2687be1f7e9b02f7',
    },
  ],
})

export default router
