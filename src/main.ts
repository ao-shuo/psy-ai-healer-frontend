// sockjs-client (and some other deps) expect a Node-like `global`.
// In Vite/browser builds it may be missing, causing: ReferenceError: global is not defined
;(globalThis as any).global = globalThis

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
