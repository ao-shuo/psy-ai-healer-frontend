<template>
  <section class="container">
    <h1>AI疗愈舱</h1>
    <div class="controls">
      <button v-if="!sessionId" @click="createSession" :disabled="loading">开始新会话</button>
      <span v-if="sessionId">会话ID：{{ sessionId }}</span>
      <button v-if="sessionId && !connected" @click="connectWs">连接实时对话</button>
      <button v-if="connected" @click="disconnectWs">断开</button>
      <button @click="goLive2D" :disabled="loading || sending">进入数字人页面</button>
    </div>
    <div v-if="sessionId" class="chat">
      <div ref="messagesEl" class="messages">
        <div v-for="m in messages" :key="m.id ?? m._localKey" :class="['message', m.sender?.toLowerCase()]">
          <small>{{ formatTime(m.createdAt) }}</small>
          <p>
            {{ m.content }}
            <em v-if="m.strategy">（策略：{{ m.strategy }}）</em>
          </p>
        </div>
      </div>
      <div class="input">
        <textarea v-model="draft" rows="3" placeholder="输入你的想法..." />
        <button @click="send" :disabled="!draft || sending">发送</button>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/services/api'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'

const auth = useAuthStore()
const af = authFetch(auth.token)
const router = useRouter()
const authToken = auth.token || localStorage.getItem('token') || ''

const loading = ref(false)
const sending = ref(false)
const sessionId = ref<number | null>(null)
const messages = ref<any[]>([])
const draft = ref('')

const messagesEl = ref<HTMLElement | null>(null)

let client: Client | null = null
const connected = ref(false)

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
  await nextTick()
  scrollToBottom(true)
}

const scrollToBottom = (force = false) => {
  const el = messagesEl.value
  if (!el) return
  if (force) {
    el.scrollTop = el.scrollHeight
    return
  }
  el.scrollTop = el.scrollHeight
}

const connectWs = async () => {
  if (!sessionId.value || client) return
  client = new Client({
    webSocketFactory: () => new SockJS('/ws'),
    reconnectDelay: 5000,
    connectHeaders: {
      Authorization: authToken ? `Bearer ${authToken}` : ''
    },
    onConnect: () => {
      connected.value = true
      client?.subscribe(`/topic/session/${sessionId.value}`, (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          const text = (payload?.reply ?? payload?.content ?? '').toString().trim()
          if (text) {
            const last = messages.value[messages.value.length - 1]
            if (!(last && (last.sender ?? '').toString().toUpperCase() === 'AGENT' && last.content === text)) {
              messages.value.push({
                content: text,
                sender: 'AGENT',
                createdAt: new Date().toISOString(),
                strategy: payload?.strategy,
                _localKey: Date.now() + Math.random(),
              })
            }
            nextTick(() => scrollToBottom())
          }
        } catch {
          // ignore
        }
      })
    },
    onDisconnect: () => {
      connected.value = false
    },
  })
  client.activate()
}

const disconnectWs = () => {
  client?.deactivate()
  client = null
  connected.value = false
}

const goLive2D = () => {
  if (sessionId.value) {
    router.push({ name: 'live2d', query: { sessionId: String(sessionId.value) } })
    return
  }
  router.push({ name: 'live2d' })
}

const send = async () => {
  if (!sessionId.value || !draft.value) return
  sending.value = true
  try {
    const content = draft.value
    // Prefer WebSocket realtime if connected; fallback to REST.
    if (client && connected.value) {
      client.publish({
        destination: `/app/chat/${sessionId.value}`,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: JSON.stringify({ content })
      })
      messages.value.push({ content, sender: 'USER', createdAt: new Date().toISOString(), _localKey: Date.now() + Math.random() })
      draft.value = ''
      await nextTick()
      scrollToBottom()
      return
    }

    const resp = await af(`/therapy/sessions/${sessionId.value}/message`, { method: 'POST', body: { content } })
    messages.value.push({ content, sender: 'USER', createdAt: new Date().toISOString(), _localKey: Date.now() + Math.random() })
    if (resp?.reply) {
      messages.value.push({ content: resp.reply, sender: 'AGENT', createdAt: new Date().toISOString(), strategy: resp.strategy, _localKey: Date.now() + Math.random() })
    }
    draft.value = ''
    await nextTick()
    scrollToBottom()
  } finally {
    sending.value = false
  }
}

const formatTime = (iso?: string) => {
  try { return new Date(iso ?? Date.now()).toLocaleString() } catch { return '' }
}

onMounted(async () => {
  // optionally auto-create session on mount
})

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

onBeforeUnmount(() => {
  disconnectWs()
})
</script>

<style scoped>
.container { max-width: 800px; margin: 24px auto; padding: 0 16px; color: var(--color-ink); }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.controls button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid var(--border-1); background: var(--surface-2); color: var(--color-ink-strong); cursor: pointer; }
.controls button:disabled { opacity: 0.6; cursor: not-allowed; }

.chat { border: 1px solid var(--border-1); border-radius: 1rem; padding: 12px; background: var(--surface-2); }
.messages { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow: auto; }

.message { padding: 10px; border-radius: 0.9rem; border: 1px solid var(--border-1); background: var(--surface-1); color: var(--color-ink); }
.message.user { background: rgba(72, 187, 120, 0.15); }
.message.agent { background: rgba(59, 146, 221, 0.15); }
.message p { color: var(--color-ink); margin: 0.25rem 0 0; }
.message small { color: var(--color-ink-muted); }
.message em { color: var(--color-ink-muted); font-style: normal; }

.input { margin-top: 12px; display: flex; gap: 8px; }
textarea { flex: 1; padding: 0.65rem 0.9rem; border-radius: 0.9rem; border: 1px solid var(--border-1); background: var(--surface-1); color: var(--color-ink-strong); }
textarea::placeholder { color: var(--color-ink-muted); }
.input button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid var(--border-1); background: var(--surface-2); color: var(--color-ink-strong); cursor: pointer; }
.input button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
