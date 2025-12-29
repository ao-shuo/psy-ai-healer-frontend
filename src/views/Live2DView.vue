<template>
  <section class="container">
    <h1>Live2D 数字人</h1>

    <div class="controls">
      <button v-if="!sessionId" @click="createSession" :disabled="loading">创建疗愈会话</button>
      <span v-if="sessionId">会话ID：{{ sessionId }}</span>
      <button v-if="sessionId && !connected" @click="connectWs">连接 WebSocket</button>
      <button v-if="connected" @click="disconnectWs">断开</button>

      <button v-if="modelReady" @click="randomMotion">随机动作</button>
      <button v-if="modelReady" @click="randomExpression">随机表情</button>
      <label v-if="modelReady" class="toggle">
        <input v-model="mouseFollow" type="checkbox" />
        鼠标跟随
      </label>

      <label class="toggle">
        <input v-model="ttsEnabled" type="checkbox" @change="onToggleTts" />
        语音播报
      </label>
      <button v-if="ttsEnabled" @click="testTts">测试语音</button>

      <button @click="goBack">返回疗愈舱</button>
    </div>

    <div class="layout">
      <div class="stage">
        <div ref="stageEl" class="stage-inner" />
        <p v-if="modelError" class="error">{{ modelError }}</p>
        <p v-else-if="!modelReady" class="hint">
          模型未加载。请把 Live2D 模型文件放到 public/live2d/，并在本页设置正确的 model.json 路径。
        </p>
        <p v-else class="hint">点击触发动作，双击切换表情；开启“鼠标跟随”可注视指针。</p>
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
import { Application, Ticker } from 'pixi.js'

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
let pixiApp: Application | null = null
let live2dSprite: any | null = null
let resizeObserver: ResizeObserver | null = null
let cleanupCanvasEvents: (() => void) | null = null
const modelReady = ref(false)
const modelError = ref<string>('')

const mouseFollow = ref(true)

const ttsEnabled = ref(false)
const ttsReady = ref(false)
const selectedVoiceName = ref<string>('')

let easyLive2D: any | null = null

// 默认模型路径：你需要把实际模型文件放到 public/live2d/ 下
const modelUrl = computed(() => {
  const q = route.query.model
  if (typeof q === 'string' && q.trim()) return q.trim()
  // easy-live2d targets Cubism 5 models (typically *.model3.json)
  return '/live2d/mao_pro_en/mao_pro.model3.json'
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

    // easy-live2d (v0.4.x) exports Live2DSprite/Config/LogLevel/Priority.
    // It also requires Cubism Core to be loaded globally (live2dcubismcore.js).
    const core = (globalThis as any).Live2DCubismCore
    if (!core) {
      throw new Error(
        '未加载 Live2D Cubism Core：请下载 Live2D Cubism SDK for Web，并将 Core/live2dcubismcore.js 放到 public/live2d/Core/，同时确保 index.html 引入 /live2d/Core/live2dcubismcore.js'
      )
    }

    // Preflight: ensure model json is reachable to avoid silent failures and WebGL spam.
    const modelPath = modelUrl.value
    const resp = await fetch(modelPath, { cache: 'no-store' })
    if (!resp.ok) {
      throw new Error(
        `模型文件未找到（${resp.status}）：${modelPath}。请把模型放到 public/live2d/ 下，或用 /live2d?model=/live2d/xxx/your.model3.json 指定正确路径。`
      )
    }

    const mod: any = await import('easy-live2d')
    easyLive2D = mod?.default ?? mod
    const Live2DSprite = easyLive2D?.Live2DSprite
    const Config = easyLive2D?.Config
    const LogLevel = easyLive2D?.LogLevel
    if (!Live2DSprite) {
      throw new Error('easy-live2d 未正确加载：找不到 Live2DSprite')
    }

    // Set some safe defaults
    if (Config) {
      try {
        Config.MotionGroupIdle = 'Idle'
        Config.MouseFollow = !!mouseFollow.value
        if (LogLevel) {
          Config.CubismLoggingLevel = LogLevel.LogLevel_Off
        }
      } catch {
        // ignore
      }
    }

    // Create & init Live2D sprite (easy-live2d init returns boolean, not Promise)
    live2dSprite = new Live2DSprite()
    const ok = live2dSprite.init({
      modelPath,
      ticker: Ticker.shared,
    })
    if (!ok) {
      throw new Error(`Live2D 初始化失败：无法加载模型 ${modelPath}`)
    }

    pixiApp = new Application()
    await pixiApp.init({
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: stageEl.value,
    })
    // Match renderer resolution to device DPR (let pixi handle scaling)
    try {
      ;(pixiApp.renderer as any).resolution = window.devicePixelRatio || 1
    } catch {
      // ignore
    }
    stageEl.value.appendChild(pixiApp.canvas)

    // Pointer interactions (best-effort): mouse follow + tap interactions
    bindCanvasInteractions(pixiApp.canvas)

    // Layout: center + uniform scale to fit container
    layoutLive2D()

    // Keep layout in sync with container size changes
    try {
      resizeObserver?.disconnect()
      resizeObserver = new ResizeObserver(() => layoutLive2D())
      resizeObserver.observe(stageEl.value)
    } catch {
      // ignore (older browsers)
    }

    pixiApp.stage.addChild(live2dSprite)

    // Some models report correct bounds only after at least one frame.
    try {
      requestAnimationFrame(() => {
        layoutLive2D(true)
        requestAnimationFrame(() => layoutLive2D(true))
      })
    } catch {
      // ignore
    }

    modelReady.value = true
  } catch (e: any) {
    modelError.value = e?.message || 'Live2D 模型加载失败'
  }
}

function layoutLive2D(forceUpdate = false) {
  if (!stageEl.value || !live2dSprite) return

  const w = stageEl.value.clientWidth || 1
  const h = stageEl.value.clientHeight || 1

  // Ensure transforms/bounds are up-to-date (some runtimes need a render tick)
  if (forceUpdate) {
    try {
      pixiApp?.renderer?.render?.(pixiApp.stage)
    } catch {
      // ignore
    }
  }

  // Reset scale so bounds reflect natural size
  try {
    if (live2dSprite.scale?.set) live2dSprite.scale.set(1, 1)
  } catch {
    // ignore
  }

  let bounds: any = null
  try {
    bounds = typeof live2dSprite.getLocalBounds === 'function' ? live2dSprite.getLocalBounds() : null
  } catch {
    bounds = null
  }

  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    // Fallback: just place at center if bounds are unavailable
    try {
      if (live2dSprite.position?.set) live2dSprite.position.set(w / 2, h / 2)
      else {
        live2dSprite.x = w / 2
        live2dSprite.y = h / 2
      }
    } catch {
      // ignore
    }
    return
  }

  const scale = Math.min(w / bounds.width, h / bounds.height)
  try {
    if (live2dSprite.scale?.set) live2dSprite.scale.set(scale, scale)
  } catch {
    // ignore
  }

  // Center the bounds' center point to the container's center.
  // Avoid pivot because some Live2D containers manage their own origin.
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const targetX = w / 2 - cx * scale
  const targetY = h / 2 - cy * scale

  try {
    if (live2dSprite.position?.set) live2dSprite.position.set(targetX, targetY)
    else {
      live2dSprite.x = targetX
      live2dSprite.y = targetY
    }
  } catch {
    // ignore
  }
}

function bindCanvasInteractions(canvas: HTMLCanvasElement) {
  cleanupCanvasEvents?.()

  const onDown = (e: PointerEvent) => {
    try {
      canvas.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore
    }
    live2dSprite?.onPointerBegan?.(e)
  }

  const onMove = (e: PointerEvent) => {
    if (!mouseFollow.value) return
    live2dSprite?.onPointerMoved?.(e)
  }

  const onUp = (e: PointerEvent) => {
    live2dSprite?.onPointerEnded?.(e)
  }

  const onCancel = (e: PointerEvent) => {
    live2dSprite?.onPointerCancel?.(e)
  }

  const onClick = () => {
    randomMotion()
  }

  const onDblClick = () => {
    randomExpression()
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('click', onClick)
  canvas.addEventListener('dblclick', onDblClick)

  cleanupCanvasEvents = () => {
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onCancel)
    canvas.removeEventListener('click', onClick)
    canvas.removeEventListener('dblclick', onDblClick)
  }
}

function randomExpression() {
  try {
    live2dSprite?.setRandomExpression?.()
  } catch {
    // ignore
  }
}

function randomMotion() {
  try {
    // Prefer non-idle group if present; mao_pro has an empty-string group for most motions.
    const group = ''
    const priority = easyLive2D?.Config?.PriorityNormal ?? 2
    live2dSprite?.startRandomMotion?.({ group, priority })
  } catch {
    // ignore
  }
}

function speak(text: string) {
  const t = (text ?? '').toString().trim()
  if (!t) return
  if (!ttsEnabled.value) return

  // Keep this best-effort: easy-live2d's playVoice expects an audio file (wav), not TTS.
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis

    // Cancel any ongoing speech so replies don't stack.
    synth.cancel()

    const voice = pickVoice()
    const chunks = chunkText(t, 220).slice(0, 12) // avoid extremely long speeches

    for (const part of chunks) {
      const utter = new SpeechSynthesisUtterance(part)
      utter.lang = 'zh-CN'
      if (voice) utter.voice = voice
      utter.rate = 1
      utter.pitch = 1
      utter.volume = 1
      synth.speak(utter)
    }
  } catch {
    // ignore
  }
}

function onToggleTts() {
  if (!ttsEnabled.value) {
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // ignore
    }
    return
  }
  // Prime voices; some browsers require a user gesture before speaking.
  primeVoices()
  // Give immediate feedback (also counts as a user gesture if triggered by the checkbox).
  try {
    testTts()
  } catch {
    // ignore
  }
}

function testTts() {
  if (!ttsEnabled.value) return
  speak('语音播报已开启。')
}

function primeVoices() {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    const voices = synth.getVoices?.() ?? []
    ttsReady.value = voices.length > 0
    if (!selectedVoiceName.value) {
      const v = voices.find((x) => /zh|chinese/i.test(`${x.lang} ${x.name}`)) ?? voices[0]
      if (v) selectedVoiceName.value = v.name
    }
  } catch {
    // ignore
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  try {
    const synth = window.speechSynthesis
    const voices = synth.getVoices?.() ?? []
    if (!voices.length) return null
    if (selectedVoiceName.value) {
      const exact = voices.find((v) => v.name === selectedVoiceName.value)
      if (exact) return exact
    }
    return voices.find((x) => /zh|chinese/i.test(`${x.lang} ${x.name}`)) ?? voices[0] ?? null
  } catch {
    return null
  }
}

function chunkText(text: string, maxLen: number) {
  const clean = (text ?? '').toString().replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const parts: string[] = []
  let buf = ''
  for (const token of clean.split(/([。！？!?；;,.，])/)) {
    if (!token) continue
    const next = (buf + token).trim()
    if (next.length > maxLen && buf) {
      parts.push(buf.trim())
      buf = token
    } else {
      buf = next
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

function disposeLive2D() {
  try {
    cleanupCanvasEvents?.()
    resizeObserver?.disconnect()
    live2dSprite?.destroy?.()
    pixiApp?.destroy?.(true)
  } catch {
    // ignore
  }
  live2dSprite = null
  pixiApp = null
  resizeObserver = null
  cleanupCanvasEvents = null
}

onMounted(async () => {
  initSessionFromQuery()
  // Keep TTS voices in sync (some browsers populate async)
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      ;(window.speechSynthesis as any).onvoiceschanged = () => primeVoices()
      primeVoices()
    }
  } catch {
    // ignore
  }
  await initLive2D()
  if (sessionId.value) {
    // 自动连接：减少用户点击
    await connectWs()
  }
})

onBeforeUnmount(() => {
  disconnectWs()
  try {
    window.speechSynthesis?.cancel()
  } catch {
    // ignore
  }
  disposeLive2D()
})
</script>

<style scoped>
.container { max-width: 1100px; margin: 24px auto; padding: 0 16px; color: var(--color-ink); }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.controls button { padding: 0.5rem 1.1rem; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: var(--color-ink-strong); cursor: pointer; }
.controls button:disabled { opacity: 0.6; cursor: not-allowed; }
.toggle { display: inline-flex; align-items: center; gap: 8px; padding: 0.45rem 0.9rem; border-radius: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: var(--color-ink-strong); }
.toggle input { width: 16px; height: 16px; }
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
