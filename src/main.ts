import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import '@lukso/web-components/components/lukso-profile'
import '@lukso/web-components/components/lukso-username'

createApp(App).use(router).mount('#app')
