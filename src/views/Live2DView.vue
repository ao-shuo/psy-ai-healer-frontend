<template>
  <section class="container">
    <h1>Live2D 数字人</h1>

    <div class="controls">
      <button v-if="!sessionId" @click="createSession" :disabled="loading">创建疗愈会话</button>
      <span v-if="sessionId">会话ID：{{ sessionId }}</span>
      <button v-if="sessionId && !connected" @click="connectWs">连接 WebSocket</button>
      <button v-if="connected" @click="disconnectWs">断开</button>

      <button v-if="!modelReady" @click="startLive2D" :disabled="live2dLoading">启动 Live2D</button>
      <button v-else @click="restartLive2D" :disabled="live2dLoading">重载模型</button>

      <button v-if="modelReady" @click="setRandomExpression" :disabled="live2dLoading || !expressionIds.length">随机表情</button>
      <button v-if="modelReady" @click="() => startVariedMotion({ preferNonIdle: true, allowIdle: true })" :disabled="live2dLoading || !Object.keys(motionGroups).length">随机动作</button>
      <button v-if="modelReady" @click="() => startVariedMotion({ preferredGroup: 'Idle', allowIdle: true })" :disabled="live2dLoading || !('Idle' in motionGroups)">Idle动作</button>
      <button v-if="modelReady" @click="resetExpression" :disabled="live2dLoading || !expressionIds.length">重置表情</button>

      <button @click="goBack">返回疗愈舱</button>
    </div>

    <div class="layout">
      <div class="stage">
        <div ref="stageEl" class="stage-inner" />
        <p v-if="modelError" class="error">{{ modelError }}</p>
        <p v-else-if="!modelReady" class="hint">
          模型未加载。请先点击“启动 Live2D”（需要一次用户点击以解锁音频），并确保模型文件在 public/live2d/。
        </p>
        <p v-else class="hint">提示：点击模型头部/身体可互动。</p>
      </div>

      <div class="chat">
        <div ref="messagesEl" class="messages">
          <div v-for="m in messages" :key="m.id ?? m._localKey" :class="['message', (m.sender ?? 'agent').toLowerCase()]">
            <small>{{ formatTime(m.createdAt) }}</small>
            <p>
              {{ m.content }}
              <em v-if="m.strategy">（策略：{{ m.strategy }}）</em>
            </p>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const draft = ref('')

const messagesEl = ref<HTMLElement | null>(null)

let client: Client | null = null

const stageEl = ref<HTMLElement | null>(null)
let pixiApp: any | null = null
let live2dSprite: any | null = null
let removeResizeListener: null | (() => void) = null
const modelReady = ref(false)
const modelError = ref<string>('')
const live2dLoading = ref(false)

const expressionIds = ref<string[]>([])
const motionGroups = ref<Record<string, number>>({})
let lastExpressionIndex = -1

const lastMotionIndexByGroup = ref<Record<string, number>>({})
const lastMotionGroup = ref<string>('')

const setExpression = (expressionId?: string) => {
  const id = (expressionId ?? '').toString().trim()
  if (!id) return
  try {
    live2dSprite?.setExpression?.({ expressionId: id })
  } catch {
    // ignore
  }
}

const setRandomExpression = () => {
  const list = expressionIds.value
  if (!list.length) return
  let idx = Math.floor(Math.random() * list.length)
  if (list.length > 1 && idx === lastExpressionIndex) {
    idx = (idx + 1) % list.length
  }
  lastExpressionIndex = idx
  setExpression(list[idx])
}

const resetExpression = () => {
  const list = expressionIds.value
  if (!list.length) return
  lastExpressionIndex = -1
  setExpression(list[0])
}

const startMotion = (group: string, no: number, priority = 3) => {
  try {
    live2dSprite?.startMotion?.({ group, no, priority })
  } catch {
    // ignore
  }
}

const startRandomMotion = (preferredGroup?: string) => {
  const groups = motionGroups.value
  const keys = Object.keys(groups)
  if (!keys.length) return

  let group: string = (preferredGroup ?? '').toString()
  if (!group || !(group in groups)) {
    const picked = keys[Math.floor(Math.random() * keys.length)]
    group = (picked ?? keys[0] ?? '').toString()
    if (!group) return
  }
  const count = groups[group] ?? 0
  if (count <= 0) return
  const no = Math.floor(Math.random() * count)
  startMotion(group, no)
}

const pickDifferentIndex = (count: number, lastIndex: number) => {
  if (count <= 1) return 0
  let idx = Math.floor(Math.random() * count)
  if (idx === lastIndex) {
    idx = (idx + 1 + Math.floor(Math.random() * (count - 1))) % count
  }
  return idx
}

const startVariedMotion = (opts?: { preferredGroup?: string; preferNonIdle?: boolean; allowIdle?: boolean }) => {
  const groups = motionGroups.value
  const keys = Object.keys(groups)
  if (!keys.length) return

  const preferNonIdle = opts?.preferNonIdle ?? false
  const allowIdle = opts?.allowIdle ?? true
  const preferred = (opts?.preferredGroup ?? '').toString()

  const nonIdleKeys = keys.filter((k) => k !== 'Idle')
  const idleOk = allowIdle && keys.includes('Idle')

  let group = preferred
  if (!group || !(group in groups)) {
    // Weighted group choice: prefer non-idle to reduce "呆板"
    const candidateKeys = preferNonIdle && nonIdleKeys.length ? nonIdleKeys : keys
    let picked = candidateKeys[Math.floor(Math.random() * candidateKeys.length)]

    // Avoid repeating the same group back-to-back when we have alternatives.
    if (candidateKeys.length > 1 && picked === lastMotionGroup.value) {
      const alt = candidateKeys.filter((k) => k !== lastMotionGroup.value)
      picked = alt[Math.floor(Math.random() * alt.length)]
    }

    group = (picked ?? candidateKeys[0] ?? '').toString()
    if (!group) return

    // Occasionally allow idle even when preferNonIdle=true for more natural variation.
    if (preferNonIdle && idleOk && Math.random() < 0.15) {
      group = 'Idle'
    }
  }

  const count = groups[group] ?? 0
  if (count <= 0) return

  const lastIdx = lastMotionIndexByGroup.value[group] ?? -1
  const no = pickDifferentIndex(count, lastIdx)

  lastMotionIndexByGroup.value = { ...lastMotionIndexByGroup.value, [group]: no }
  lastMotionGroup.value = group
  startMotion(group, no)
}

// 默认模型路径：你需要把实际模型文件放到 public/live2d/ 下
const modelUrl = computed(() => {
  const q = route.query.model
  if (typeof q === 'string' && q.trim()) return q.trim()
  // Default to the bundled sample model (copied from workspace assets into public/live2d/mao_pro/)
  return '/live2d/mao_pro/mao_pro.model3.json'
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
  await nextTick()
  scrollToBottom(true)
}

const scrollToBottom = (force = false) => {
  const el = messagesEl.value
  if (!el) return
  // Always keep chat pinned to bottom for this app; force is used after initial load.
  if (force) {
    el.scrollTop = el.scrollHeight
    return
  }
  // If user has scrolled up a lot, still follow new messages (requested “更实时”).
  el.scrollTop = el.scrollHeight
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
          // WS payload is a ChatResponse: { reply, strategy, ... }
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
            // Model reaction on agent reply (prefer non-idle to feel less repetitive)
            setRandomExpression()
            startVariedMotion({ preferNonIdle: true, allowIdle: true })
            nextTick(() => scrollToBottom())
          }

          // Drive lip-sync for AI replies.
          // payload.reply is used by ChatResponse; payload.content may exist depending on sender.
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
    const content = draft.value
    // 发送到后端：@MessageMapping("/chat/{sessionId}")，前缀是 /app
    client.publish({
      destination: `/app/chat/${sessionId.value}`,
      headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {},
      body: JSON.stringify({ content })
    })

    messages.value.push({
      content,
      sender: 'USER',
      createdAt: new Date().toISOString(),
      _localKey: Date.now() + Math.random()
    })

    // Model reaction on user send
    setRandomExpression()
    startVariedMotion({ preferNonIdle: true, allowIdle: true })

    // Optional: let the avatar "repeat" user's message; comment out if undesired.
    // speak(draft.value)

    draft.value = ''
    await nextTick()
    scrollToBottom()
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

    if (!(globalThis as any).Live2DCubismCore) {
      throw new Error(
        '未加载 Live2D Cubism Core：请下载 Live2D Cubism SDK for Web，并将 Core/live2dcubismcore.js 放到 public/live2d/Core/，确保 index.html 引入 /live2d/Core/live2dcubismcore.js'
      )
    }

    // Preflight: verify model json is reachable to avoid hard-to-read WebGL errors.
    const modelProbe = await fetch(modelUrl.value, { cache: 'no-store' })
    if (!modelProbe.ok) {
      throw new Error(
        `模型文件未找到（${modelProbe.status}）：${modelUrl.value}。请把模型放到 public/live2d/ 下，或用 ?model=/live2d/xxx/your.model3.json 指定正确路径。`
      )
    }

    // Build interaction lists from model json (expressions / motions).
    try {
      const modelJson = await modelProbe.clone().json()
      const expr = modelJson?.FileReferences?.Expressions
      if (Array.isArray(expr)) {
        expressionIds.value = expr.map((e: any) => String(e?.Name ?? '')).filter((v: string) => !!v)
      } else {
        expressionIds.value = []
      }

      const motions = modelJson?.FileReferences?.Motions
      const groups: Record<string, number> = {}
      if (motions && typeof motions === 'object') {
        for (const k of Object.keys(motions)) {
          const arr = motions[k]
          if (Array.isArray(arr) && arr.length > 0) {
            groups[k] = arr.length
          }
        }
      }
      motionGroups.value = groups
    } catch {
      expressionIds.value = []
      motionGroups.value = {}
    }

    // Only initialize after a user gesture (button click) to satisfy Chrome autoplay policy.
    const [{ Application, Ticker }, easyLive2d] = await Promise.all([import('pixi.js'), import('easy-live2d')])
    const Live2DSprite = (easyLive2d as any).Live2DSprite
    const Config = (easyLive2d as any).Config

    // Simple interaction: mouse-follow
    try {
      if (Config) {
        Config.MouseFollow = true
      }
    } catch {
      // ignore
    }

    pixiApp = new Application()
    await pixiApp.init({
      resizeTo: stageEl.value,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
    })

    stageEl.value.appendChild(pixiApp.canvas)

    // Important:
    // easy-live2d internally drives its own WebGL rendering loop on the same canvas.
    // If Pixi keeps auto-rendering every frame too, WebGL state/program can conflict and
    // you'll see errors like: uniformMatrix3fv location is not from the associated program.
    // So we:
    // 1) initialize Live2D with Ticker.shared
    // 2) render Pixi once to trigger Live2DSprite's first-time setup
    // 3) stop Pixi's continuous render loop
    live2dSprite = new Live2DSprite()
    live2dSprite.init({
      modelPath: modelUrl.value,
      ticker: Ticker.shared,
    })

    // Default expression (if any)
    if (expressionIds.value.length) {
      setExpression(expressionIds.value[0])
    }

    // Tap interactions
    try {
      live2dSprite.onLive2D?.('hit', ({ hitAreaName }: any) => {
        const name = String(hitAreaName ?? '').toLowerCase()
        if (name.includes('head')) {
          setRandomExpression()
          // Head taps: lighter motions, but not always idle
          startVariedMotion({ preferNonIdle: true, allowIdle: true })
          return
        }
        if (name.includes('body')) {
          // Body taps: prefer non-idle motions
          startVariedMotion({ preferNonIdle: true, allowIdle: true })
          return
        }
        setRandomExpression()
        startVariedMotion({ preferNonIdle: true, allowIdle: true })
      })
    } catch {
      // ignore
    }

    pixiApp.stage.addChild(live2dSprite)

    const layout = () => {
      if (!pixiApp || !live2dSprite) return
      // Follow library examples: size the sprite to canvas physical pixels.
      const el = stageEl.value
      const w = Math.max(1, (el?.clientWidth ?? 1) * window.devicePixelRatio)
      const h = Math.max(1, (el?.clientHeight ?? 1) * window.devicePixelRatio)
      live2dSprite.width = w
      live2dSprite.height = h
      live2dSprite.x = 0
      live2dSprite.y = 0
    }
    layout()

    // Render once to let Live2DSprite run its onRender initialization.
    try {
      pixiApp.renderer.render(pixiApp.stage)
    } catch {
      // ignore
    }

    // Stop Pixi's continuous render loop (Live2D updates are driven by Ticker.shared).
    try {
      pixiApp.stop?.()
      pixiApp.ticker?.stop?.()
    } catch {
      // ignore
    }

    const onResize = () => layout()
    window.addEventListener('resize', onResize)
    removeResizeListener = () => window.removeEventListener('resize', onResize)

    modelReady.value = true
  } catch (e: any) {
    modelError.value = e?.message || 'Live2D 模型加载失败'
  }
}

async function startLive2D() {
  if (live2dLoading.value) return
  live2dLoading.value = true
  try {
    await initLive2D()
  } finally {
    live2dLoading.value = false
  }
}

async function restartLive2D() {
  if (live2dLoading.value) return
  live2dLoading.value = true
  try {
    disposeLive2D()
    await initLive2D()
  } finally {
    live2dLoading.value = false
  }
}

function speak(text: string) {
  const t = (text ?? '').toString().trim()
  if (!t) return
  // easy-live2d does not provide built-in TTS. Keep this as a no-op for now.
  // (Avoid triggering AudioContext without a user gesture.)
}

function disposeLive2D() {
  try {
    removeResizeListener?.()
    removeResizeListener = null
    live2dSprite?.destroy?.({ children: true })
    live2dSprite = null
    pixiApp?.destroy?.(true)
    pixiApp = null
  } catch {
    // ignore
  }
  modelReady.value = false
}

onMounted(async () => {
  initSessionFromQuery()
  if (sessionId.value) {
    // 自动连接：减少用户点击
    await connectWs()
  }
})

watch(
  () => sessionId.value,
  async () => {
    // When switching sessions via route, keep scroll pinned to bottom after history loads.
    await nextTick()
    scrollToBottom(true)
  }
)

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

onBeforeUnmount(() => {
  disconnectWs()
  disposeLive2D()
})
</script>

<style scoped>
.container { max-width: 1100px; margin: 24px auto; padding: 0 16px; color: var(--color-ink); }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.controls button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid var(--border-1); background: var(--surface-2); color: var(--color-ink-strong); cursor: pointer; }
.controls button:disabled { opacity: 0.6; cursor: not-allowed; }
.layout { display: grid; grid-template-columns: 420px 1fr; gap: 16px; align-items: stretch; }
.stage { border: 1px solid var(--border-1); border-radius: 1rem; padding: 12px; min-height: 540px; background: var(--surface-2); }
.stage-inner { width: 100%; height: 500px; }
.hint { color: var(--color-ink-muted); font-size: 12px; margin-top: 8px; }
.error { color: rgba(255, 120, 120, 0.95); font-size: 12px; margin-top: 8px; }
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
@media (max-width: 980px) {
  .layout { grid-template-columns: 1fr; }
  .stage-inner { height: 360px; }
}
</style>
