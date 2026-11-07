import { createRouter, type Router, type RouterHistory } from 'vue-router'

import HomePage from '@/pages/home/HomePage.vue'
import NotFoundPage from '@/pages/not-found/NotFoundPage.vue'

export function createAppRouter(history: RouterHistory): Router {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'home', component: HomePage },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
    ],
  })
}
