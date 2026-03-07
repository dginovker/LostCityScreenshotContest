import { createRouter, createWebHashHistory } from 'vue-router'
import CompareView from './views/CompareView.vue'
import HighscoresView from './views/HighscoresView.vue'
import HistoryView from './views/HistoryView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: CompareView },
    { path: '/highscores', component: HighscoresView },
    { path: '/history', component: HistoryView },
  ],
})
