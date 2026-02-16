import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import '@lukso/web-components/components/lukso-profile'

declare const __APP_VERSION__: string
console.log('[ActivityFeed] v' + __APP_VERSION__)
import '@lukso/web-components/components/lukso-username'

createApp(App).use(router).mount('#app')
