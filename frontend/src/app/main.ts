import { createApp } from 'vue'
import { createWebHistory } from 'vue-router'

import App from './App.vue'
import { createAppI18n } from './providers/i18n'
import { createAppRouter } from './router'
import './styles/base.css'

createApp(App).use(createAppI18n()).use(createAppRouter(createWebHistory())).mount('#app')
