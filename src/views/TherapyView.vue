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
      <div class="messages">
        <div v-for="m in messages" :key="m.id ?? m._localKey" :class="['message', m.sender?.toLowerCase()]">
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
        <button @click="send" :disabled="!draft || sending">发送</button>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
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
const realtime = ref<any[]>([])
const draft = ref('')

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
          realtime.value.push({ ...payload, _localKey: Date.now() + Math.random() })
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
    // Prefer WebSocket realtime if connected; fallback to REST.
    if (client && connected.value) {
      client.publish({
        destination: `/app/chat/${sessionId.value}`,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: JSON.stringify({ content: draft.value })
      })
      messages.value.push({ content: draft.value, sender: 'USER', createdAt: new Date().toISOString(), _localKey: Date.now() + Math.random() })
      draft.value = ''
      return
    }

    const resp = await af(`/therapy/sessions/${sessionId.value}/message`, { method: 'POST', body: { content: draft.value } })
    realtime.value.push({ content: resp.reply, strategy: resp.strategy, _localKey: Date.now() + Math.random() })
    messages.value.push({ content: draft.value, sender: 'USER', createdAt: new Date().toISOString(), _localKey: Date.now() + Math.random() })
    draft.value = ''
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

onBeforeUnmount(() => {
  disconnectWs()
})
</script>

<style scoped>
.container { max-width: 800px; margin: 24px auto; padding: 0 16px; color: var(--color-ink); }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.controls button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: var(--color-ink-strong); cursor: pointer; }
.controls button:disabled { opacity: 0.6; cursor: not-allowed; }

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
</style>
