<template>
  <section class="container">
    <h1>Live2D 数字人</h1>

    <div class="controls">
      <button v-if="!sessionId" @click="createSession" :disabled="loading">创建疗愈会话</button>
      <span v-if="sessionId">会话ID：{{ sessionId }}</span>
      <button v-if="sessionId && !connected" @click="connectWs">连接 WebSocket</button>
      <button v-if="connected" @click="disconnectWs">断开</button>

      <button @click="goBack">返回疗愈舱</button>
    </div>

    <div class="layout">
      <div class="stage">
        <div ref="stageEl" class="stage-inner" />
        <p v-if="modelError" class="error">{{ modelError }}</p>
        <p v-else-if="!modelReady" class="hint">
          模型未加载。请把 Live2D 模型文件放到 public/live2d/，并在本页设置正确的 model.json 路径。
        </p>
      </div>

      <div class="chat">
        <div class="messages">
          <div v-for="m in messages" :key="m.id ?? m._localKey" :class="['message', (m.sender ?? 'agent').toLowerCase()]">
            <small>{{ formatTime(m.createdAt) }}</small>
            <p>{{ m.content }}</p>
          </div>
          <div v-for="r in realtime" :key="r._localKey" class="message agent">
            <small>实时</small>
            <p>{{ r.content }} <em>（策略：{{ r.strategy }}）</em></p>
          </div>
        </div>

        <div class="input">
          <textarea v-model="draft" rows="3" placeholder="输入你的想法..." />
          <button @click="send" :disabled="!draft || sending || !connected || !sessionId">发送</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/services/api'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const af = authFetch(auth.token)

const authToken = computed(() => auth.token || localStorage.getItem('token') || '')

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const wsBaseUrl = (import.meta.env.VITE_WS_BASE_URL || apiBaseUrl.replace(/\/api\/?$/, '')).replace(/\/$/, '')

const loading = ref(false)
const sending = ref(false)
const connected = ref(false)

const sessionId = ref<number | null>(null)

const messages = ref<any[]>([])
const realtime = ref<any[]>([])
const draft = ref('')

let client: Client | null = null

const stageEl = ref<HTMLElement | null>(null)
let live2dManager: any | null = null
const modelReady = ref(false)
const modelError = ref<string>('')

// 默认模型路径：你需要把实际模型文件放到 public/live2d/ 下
const modelUrl = computed(() => {
  const q = route.query.model
  if (typeof q === 'string' && q.trim()) return q.trim()
  return '/live2d/model.json'
})

const modelPathParts = computed(() => {
  // Convert '/live2d/xxx/model.json' => { assetsRoot: '/live2d/xxx/', model: 'model.json' }
  const raw = String(modelUrl.value ?? '')
  const clean = (raw.split('?')[0] ?? '').split('#')[0] ?? ''
  if (!clean) {
    return { assetsRoot: '/live2d/', model: 'model.json' }
  }
  const idx = clean.lastIndexOf('/')
  if (idx <= 0) {
    return { assetsRoot: '/', model: clean.replace(/^\//, '') }
  }
  return {
    assetsRoot: clean.slice(0, idx + 1),
    model: clean.slice(idx + 1),
  }
})

const initSessionFromQuery = () => {
  const q = route.query.sessionId
  if (typeof q === 'string' && q.trim()) {
    const n = Number(q)
    if (Number.isFinite(n) && n > 0) sessionId.value = n
  }
}

const createSession = async () => {
  loading.value = true
  try {
    const session = await af('/therapy/sessions', { method: 'POST', body: { topic: '情绪疏导' } })
    sessionId.value = session.id
    await loadMessages()
  } finally {
    loading.value = false
  }
}

const loadMessages = async () => {
  if (!sessionId.value) return
  const data = await af(`/therapy/sessions/${sessionId.value}/messages`)
  messages.value = data ?? []
}

const connectWs = async () => {
  if (!sessionId.value || client) return

  client = new Client({
    webSocketFactory: () => new SockJS(`${wsBaseUrl}/ws`),
    reconnectDelay: 3000,
    connectHeaders: {
      Authorization: authToken.value ? `Bearer ${authToken.value}` : ''
    },
    onConnect: async () => {
      connected.value = true
      await loadMessages()
      client?.subscribe(`/topic/session/${sessionId.value}`, (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          realtime.value.push({ ...payload, _localKey: Date.now() + Math.random() })

          // Drive lip-sync for AI replies.
          // payload.reply is used by ChatResponse; payload.content may exist depending on sender.
          const text = (payload?.reply ?? payload?.content ?? '').toString().trim()
          if (text) {
            speak(text)
          }
        } catch {
          // ignore
        }
      })
    },
    onDisconnect: () => {
      connected.value = false
    }
  })

  client.activate()
}

const disconnectWs = () => {
  client?.deactivate()
  client = null
  connected.value = false
}

const send = async () => {
  if (!sessionId.value || !draft.value || !client || !connected.value) return
  sending.value = true
  try {
    // 发送到后端：@MessageMapping("/chat/{sessionId}")，前缀是 /app
    client.publish({
      destination: `/app/chat/${sessionId.value}`,
      headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {},
      body: JSON.stringify({ content: draft.value })
    })

    messages.value.push({
      content: draft.value,
      sender: 'USER',
      createdAt: new Date().toISOString(),
      _localKey: Date.now() + Math.random()
    })

    // Optional: let the avatar "repeat" user's message; comment out if undesired.
    // speak(draft.value)

    draft.value = ''
  } finally {
    sending.value = false
  }
}

const formatTime = (iso?: string) => {
  try {
    return new Date(iso ?? Date.now()).toLocaleString()
  } catch {
    return ''
  }
}

const goBack = () => {
  router.push({ name: 'therapy', query: sessionId.value ? { sessionId: String(sessionId.value) } : {} })
}

async function initLive2D() {
  modelError.value = ''
  modelReady.value = false

  if (!stageEl.value) return

  try {
    stageEl.value.innerHTML = ''

    // easy-live2d expects a container element; it will create/manage canvas internally.
    const { assetsRoot, model } = modelPathParts.value

    const mod: any = await import('easy-live2d')
    const Live2DManager = mod?.Live2DManager || mod?.default?.Live2DManager || (globalThis as any)?.EasyLive2D?.Live2DManager
    if (!Live2DManager) {
      throw new Error('easy-live2d 未正确加载：找不到 Live2DManager')
    }

    live2dManager = new Live2DManager({
      assetsRoot,
      model,
      canvas: stageEl.value,
    })

    await live2dManager.init()
    modelReady.value = true
  } catch (e: any) {
    modelError.value = e?.message || 'Live2D 模型加载失败'
  }
}

function speak(text: string) {
  const t = (text ?? '').toString().trim()
  if (!t) return
  if (!live2dManager || typeof live2dManager.speak !== 'function') return
  try {
    live2dManager.speak(t, {
      lang: 'zh-CN',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    })
  } catch {
    // ignore
  }
}

function disposeLive2D() {
  try {
    live2dManager?.destroy?.()
  } catch {
    // ignore
  }
  live2dManager = null
}

onMounted(async () => {
  initSessionFromQuery()
  await initLive2D()
  if (sessionId.value) {
    // 自动连接：减少用户点击
    await connectWs()
  }
})

onBeforeUnmount(() => {
  disconnectWs()
  disposeLive2D()
})
</script>

<style scoped>
.container { max-width: 1100px; margin: 24px auto; padding: 0 16px; color: var(--color-ink); }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.controls button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: var(--color-ink-strong); cursor: pointer; }
.controls button:disabled { opacity: 0.6; cursor: not-allowed; }
.layout { display: grid; grid-template-columns: 420px 1fr; gap: 16px; align-items: stretch; }
.stage { border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 1rem; padding: 12px; min-height: 540px; background: rgba(0, 0, 0, 0.22); }
.stage-inner { width: 100%; height: 500px; }
.hint { color: rgba(247, 249, 251, 0.7); font-size: 12px; margin-top: 8px; }
.error { color: rgba(255, 120, 120, 0.95); font-size: 12px; margin-top: 8px; }
.chat { border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 1rem; padding: 12px; background: rgba(0, 0, 0, 0.22); }
.messages { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow: auto; }
.message { padding: 10px; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(0, 0, 0, 0.18); color: var(--color-ink); }
.message.user { background: rgba(72, 187, 120, 0.15); }
.message.agent { background: rgba(59, 146, 221, 0.15); }
.message p { color: var(--color-ink); margin: 0.25rem 0 0; }
.message small { color: rgba(247, 249, 251, 0.7); }
.message em { color: rgba(247, 249, 251, 0.75); font-style: normal; }
.input { margin-top: 12px; display: flex; gap: 8px; }
textarea { flex: 1; padding: 0.65rem 0.9rem; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.22); background: rgba(0, 0, 0, 0.35); color: var(--color-ink-strong); }
textarea::placeholder { color: rgba(247, 249, 251, 0.6); }
.input button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: var(--color-ink-strong); cursor: pointer; }
.input button:disabled { opacity: 0.6; cursor: not-allowed; }
@media (max-width: 980px) {
  .layout { grid-template-columns: 1fr; }
  .stage-inner { height: 360px; }
}
</style>
