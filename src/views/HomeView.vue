<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { authFetch } from '@/services/api'
import type { ApiFetchOptions } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

type AssessmentEntry = {
  id: number
  score: number
  severity: string
  createdAt: string
  answers: string
}

type TherapySession = {
  id: number
  topic: string
  createdAt: string
}

type TherapyMessage = {
  id: number
  sender: 'USER' | 'AGENT'
  content: string
  createdAt: string
}

type KnowledgeArticle = {
  id: number
  title: string
  category: string
  content: string
  published: boolean
  createdAt: string
}

const authStore = useAuthStore()
const router = useRouter()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const authRequest = (path: string, options: ApiFetchOptions = {}) => authFetch(authStore.token)(path, options)

const phqQuestions = [
  '对做的事情提不起兴趣或乐趣明显减少',
  '心情郁闷、沮丧或绝望',
  '睡眠困难（难以入睡、早醒或睡得太多）',
  '白天感觉疲倦或没有精力',
  '食欲不振或暴饮暴食',
  '对自己感觉不好——觉得失败或让家人失望',
  '集中注意力困难、思考缓慢',
  '动作或说话比平常慢，或相反地坐立不安',
  '有想死的念头或想要伤害自己',
]

const answerOptions = [
  { value: 0, label: '完全没有 (0)' },
  { value: 1, label: '几天 (1)' },
  { value: 2, label: '一半以上 (2)' },
  { value: 3, label: '几乎每天 (3)' },
]

const answers = ref<number[]>(phqQuestions.map(() => 0))
const assessmentResult = ref<{ score: number; severity: string } | null>(null)
const assessmentHistory = ref<AssessmentEntry[]>([])
const assessmentError = ref('')
const assessmentLoading = ref(false)

const sessions = ref<TherapySession[]>([])
const therapyMessages = ref<TherapyMessage[]>([])
const selectedSessionId = ref<number | null>(null)
const messagesLoading = ref(false)
const therapyError = ref('')
const newSessionTopic = ref('情绪疏导')
const creatingSession = ref(false)
const newMessage = ref('')
const messageSending = ref(false)
const lastStrategy = ref('')

const knowledgeArticles = ref<KnowledgeArticle[]>([])
const knowledgeLoading = ref(false)
const knowledgeError = ref('')
const selectedCategory = ref('全部')

const userBadge = computed(() => authStore.username || '匿名')
const roleBadge = computed(() => (authStore.roles.length ? authStore.roles.join(', ') : '普通用户'))
const categories = computed(() => {
  const set = new Set<string>()
  knowledgeArticles.value.forEach((article) => {
    if (article.category) {
      set.add(article.category)
    }
  })
  return ['全部', ...Array.from(set)]
})

type BoardMessage = {
  id: number
  author: string
  content: string
  createdAt: string
}

const BOARD_STORAGE_KEY = 'psy-ai-board'
const BOARD_LIMIT = 16
const boardMessages = ref<BoardMessage[]>([])
const boardInput = ref('')

const loadBoardMessages = () => {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(BOARD_STORAGE_KEY)
    if (stored) {
      boardMessages.value = JSON.parse(stored)
    }
  } catch {
    // ignore
  }
}

const persistBoardMessages = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardMessages.value))
  } catch {
    // ignore
  }
}

const formatBoardTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString('zh-CN', { hour12: false })
    : '--'

const postBoardMessage = () => {
  const trimmed = boardInput.value.trim()
  if (!trimmed) return
  const entry: BoardMessage = {
    id: Date.now(),
    author: authStore.username || '访客',
    content: trimmed,
    createdAt: new Date().toISOString(),
  }
  boardMessages.value = [entry, ...boardMessages.value].slice(0, BOARD_LIMIT)
  boardInput.value = ''
}

const sortedHistory = computed(() =>
  [...assessmentHistory.value].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  ),
)

const formatTimestamp = (value?: string) =>
  value
    ? new Date(value).toLocaleString('zh-CN', {
        hour12: false,
      })
    : '--'

const resetDashboard = () => {
  assessmentHistory.value = []
  therapyMessages.value = []
  sessions.value = []
  knowledgeArticles.value = []
  selectedSessionId.value = null
  lastStrategy.value = ''
}

const fetchAssessmentHistory = async () => {
  assessmentError.value = ''
  assessmentLoading.value = true
  try {
    const data = (await authRequest('/assessments/phq9')) as AssessmentEntry[] | null
    assessmentHistory.value = Array.isArray(data) ? data : []
  } catch (error) {
    assessmentError.value = (error as Error).message
  } finally {
    assessmentLoading.value = false
  }
}

const submitAssessment = async () => {
  assessmentError.value = ''
  assessmentLoading.value = true
  try {
    const payload = { answers: answers.value }
    const response = (await authRequest('/assessments/phq9', {
      method: 'POST',
      body: payload,
    })) as { score: number; severity: string }
    assessmentResult.value = response
    await fetchAssessmentHistory()
  } catch (error) {
    assessmentError.value = (error as Error).message
  } finally {
    assessmentLoading.value = false
  }
}

const fetchSessionMessages = async (sessionId: number) => {
  messagesLoading.value = true
  therapyError.value = ''
  try {
    const data = (await authRequest(`/therapy/sessions/${sessionId}/messages`)) as TherapyMessage[] | null
    therapyMessages.value = Array.isArray(data) ? data : []
  } catch (error) {
    therapyError.value = (error as Error).message
  } finally {
    messagesLoading.value = false
  }
}

const selectSession = async (session?: TherapySession) => {
  if (!session) return
  selectedSessionId.value = session.id
  await fetchSessionMessages(session.id)
}

const fetchTherapySessions = async () => {
  therapyError.value = ''
  try {
    const data = (await authRequest('/therapy/sessions')) as TherapySession[] | null
    sessions.value = Array.isArray(data) ? data : []
    if (sessions.value.length) {
      const target = sessions.value.find((session) => session.id === selectedSessionId.value) ?? sessions.value[0]
      await selectSession(target)
    } else {
      therapyMessages.value = []
      selectedSessionId.value = null
    }
  } catch (error) {
    therapyError.value = (error as Error).message
  }
}

const fetchKnowledgeArticles = async (category = '全部') => {
  knowledgeLoading.value = true
  knowledgeError.value = ''
  try {
    const path = category === '全部' ? '/knowledge' : `/knowledge/category/${encodeURIComponent(category)}`
    const data = (await authRequest(path)) as KnowledgeArticle[] | null
    knowledgeArticles.value = Array.isArray(data) ? data : []
  } catch (error) {
    knowledgeError.value = (error as Error).message
  } finally {
    knowledgeLoading.value = false
  }
}

const createSession = async () => {
  if (!newSessionTopic.value.trim()) return
  creatingSession.value = true
  therapyError.value = ''
  try {
    const session = (await authRequest('/therapy/sessions', {
      method: 'POST',
      body: { topic: newSessionTopic.value.trim() },
    })) as TherapySession
    sessions.value = [session, ...sessions.value]
    newSessionTopic.value = '情绪疏导'
    await selectSession(session)
  } catch (error) {
    therapyError.value = (error as Error).message
  } finally {
    creatingSession.value = false
  }
}

const goLive2D = () => {
  router.push({
    name: 'live2d',
    query: selectedSessionId.value ? { sessionId: String(selectedSessionId.value) } : {},
  })
}

const sendMessage = async () => {
  if (!selectedSessionId.value || !newMessage.value.trim()) return
  messageSending.value = true
  therapyError.value = ''
  try {
    const response = (await authRequest(`/therapy/sessions/${selectedSessionId.value}/message`, {
      method: 'POST',
      body: { content: newMessage.value.trim(), sessionId: selectedSessionId.value },
    })) as { reply?: string; strategy?: string }
    lastStrategy.value = response.strategy ?? ''
    newMessage.value = ''
    await fetchSessionMessages(selectedSessionId.value)
  } catch (error) {
    therapyError.value = (error as Error).message
  } finally {
    messageSending.value = false
  }
}

const switchCategory = async (category: string) => {
  selectedCategory.value = category
  await fetchKnowledgeArticles(category)
}

const loadDashboard = async () => {
  if (!authStore.token) return
  await Promise.all([
    fetchAssessmentHistory(),
    fetchTherapySessions(),
    fetchKnowledgeArticles(selectedCategory.value),
  ])
}

onMounted(() => {
  loadBoardMessages()
  if (isAuthenticated.value) {
    loadDashboard()
  }
})

watch(isAuthenticated, (value) => {
  if (value) {
    loadDashboard()
  } else {
    resetDashboard()
  }
})

watch(
  boardMessages,
  () => {
    persistBoardMessages()
  },
  { deep: true },
)
</script>

<template>
  <section class="home-hero">
    <div>
      <p class="hero-sup">Psy AI Healer</p>
      <h1>
        掌握情绪周期
        <span>即时反馈 · 人工智能陪伴</span>
      </h1>
      <p class="hero-lead">
        连接 PHQ-9 评估、治疗会话和知识库，打造一整套一致的数字心理陪伴，2025 年持续迭代。
      </p>
    </div>
    <div class="hero-panel">
      <p class="hero-label">当前身份</p>
      <p class="hero-value">{{ userBadge }}</p>
      <p class="hero-meta">{{ roleBadge }}</p>
      <RouterLink v-if="!isAuthenticated" to="/auth" class="hero-cta">开始探索</RouterLink>
    </div>
  </section>

  <nav v-if="isAuthenticated" class="page-nav">
    <a href="#assessments">PHQ-9 心理评估</a>
    <a href="#therapy">AI 治疗会话</a>
    <a href="#knowledge">AI 知识库</a>
    <a href="#message-board">互动留言板</a>
  </nav>

  <section v-if="!isAuthenticated" class="auth-hint">
    <p>请通过登录 / 注册解锁完整的评估、会话与知识内容。</p>
    <RouterLink to="/auth" class="primary">登录 / 注册</RouterLink>
  </section>

  <section v-else class="dashboard">
    <div class="dashboard-shell">
      <div id="assessments" class="section-grid">
        <article class="panel assessment-panel">
          <header class="panel-header">
            <div>
              <p class="title">PHQ-9 心理健康自评</p>
              <p class="subtitle">输入过去两周的感受，AI 立即打分。</p>
            </div>
            <div class="status-pill" :class="{ loading: assessmentLoading }">
              {{ assessmentResult ? assessmentResult.severity : '待评估' }}
            </div>
          </header>

          <form class="questions" @submit.prevent="submitAssessment">
            <div
              v-for="(question, index) in phqQuestions"
              :key="question"
              class="question-row"
            >
              <p>{{ index + 1 }}. {{ question }}</p>
              <select v-model.number="answers[index]">
                <option
                  v-for="option in answerOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div class="form-actions">
              <button type="submit" :disabled="assessmentLoading">
                {{ assessmentLoading ? '提交中…' : '提交问卷' }}
              </button>
              <p class="score" v-if="assessmentResult">
                当前得分：<strong>{{ assessmentResult.score }}</strong>
              </p>
            </div>
          </form>

          <p class="error" v-if="assessmentError">{{ assessmentError }}</p>
        </article>

        <article class="panel history-panel">
          <header class="panel-header">
            <div>
              <p class="title">历史记录</p>
              <p class="subtitle">最近 5 次测试</p>
            </div>
            <p class="meta">共 {{ assessmentHistory.length }} 条</p>
          </header>

          <div class="history-table">
            <div class="history-row" v-for="entry in sortedHistory.slice(0, 5)" :key="entry.id">
              <div>
                <p class="history-score">{{ entry.score }} 分</p>
                <p class="history-severity">{{ entry.severity }}</p>
              </div>
              <p class="history-time">{{ formatTimestamp(entry.createdAt) }}</p>
            </div>
            <p v-if="!assessmentHistory.length" class="empty">暂无记录</p>
          </div>

          <p class="error" v-if="assessmentError && !assessmentLoading">{{ assessmentError }}</p>
        </article>
      </div>

      <div id="therapy" class="section-grid">
        <article class="panel therapy-panel">
          <header class="panel-header">
            <div>
              <p class="title">AI 治疗会话</p>
              <p class="subtitle">选择专题，开始陪伴式对话。</p>
            </div>
            <div class="panel-actions">
              <button class="ghost" type="button" @click="goLive2D">
                进入数字人
              </button>
              <button class="ghost" @click="createSession" :disabled="creatingSession">
                {{ creatingSession ? '创建中…' : '新建会话' }}
              </button>
            </div>
          </header>

          <div class="therapy-grid">
            <div class="session-list">
              <label class="input-label">会话主题</label>
              <input
                v-model="newSessionTopic"
                placeholder="例：失眠/压力管理"
              />
              <p class="meta">{{ sessions.length }} 个会话</p>
              <div class="sessions">
                <button
                  v-for="session in sessions"
                  :key="session.id"
                  :class="['session-item', { active: session.id === selectedSessionId }]"
                  @click="selectSession(session)"
                >
                  <span>{{ session.topic }}</span>
                  <small>{{ formatTimestamp(session.createdAt) }}</small>
                </button>
              </div>
              <p class="error" v-if="therapyError">{{ therapyError }}</p>
            </div>

            <div class="chat-column">
              <div class="message-board">
                <p v-if="messagesLoading" class="meta">加载消息…</p>
                <div v-else class="message" :class="[`message--${message.sender?.toLowerCase()}`, message.sender]" v-for="message in therapyMessages" :key="message.id">
                  <span class="message-body">{{ message.content }}</span>
                  <small>{{ message.sender === 'USER' ? '你' : 'AI 助理' }} · {{ formatTimestamp(message.createdAt) }}</small>
                </div>
                <p class="empty" v-if="!therapyMessages.length && !messagesLoading">请选择会话</p>
              </div>
              <div class="strategy" v-if="lastStrategy">策略：{{ lastStrategy }}</div>
              <div class="message-composer">
                <textarea
                  v-model="newMessage"
                  rows="3"
                  placeholder="向心理助手输入你的想法"
                ></textarea>
                <button @click="sendMessage" :disabled="messageSending || !selectedSessionId">
                  {{ messageSending ? '发送中…' : '发送' }}
                </button>
              </div>
            </div>
          </div>
        </article>

        <article id="knowledge" class="panel knowledge-panel">
          <header class="panel-header">
            <div>
              <p class="title">AI 知识库</p>
              <p class="subtitle">按分类浏览，沉浸式解读专业文章。</p>
            </div>
            <p class="meta">{{ knowledgeArticles.length }} 篇</p>
          </header>

          <div class="filters">
            <button
              v-for="category in categories"
              :key="category"
              class="filter"
              :class="{ active: selectedCategory === category }"
              @click="switchCategory(category)"
            >
              {{ category }}
            </button>
          </div>

          <div class="articles">
            <article v-for="article in knowledgeArticles" :key="article.id" class="article-card">
              <div class="article-header">
                <p class="article-category">{{ article.category || '未分类' }}</p>
                <p class="article-time">{{ formatTimestamp(article.createdAt) }}</p>
              </div>
              <h3>{{ article.title }}</h3>
              <p class="article-content">{{ article.content.length > 160 ? `${article.content.slice(0, 160)}…` : article.content }}</p>
            </article>
            <p v-if="!knowledgeArticles.length" class="empty">暂无文章</p>
          </div>

          <p class="error" v-if="knowledgeError">{{ knowledgeError }}</p>
        </article>
      </div>

      <article id="message-board" class="panel message-panel">
        <header class="panel-header">
          <div>
            <p class="title">互动留言板</p>
            <p class="subtitle">把当下的感受分享给社区，系统会保留你的心声。</p>
          </div>
          <p class="meta">共 {{ boardMessages.length }} 条</p>
        </header>
        <div class="messages-list">
          <article v-for="message in boardMessages" :key="message.id" class="board-message">
            <div class="board-message-header">
              <strong>{{ message.author }}</strong>
              <small>{{ formatBoardTime(message.createdAt) }}</small>
            </div>
            <p>{{ message.content }}</p>
          </article>
          <p v-if="!boardMessages.length" class="empty">暂无留言，写下你的感受即可被记录。</p>
        </div>
        <form class="message-form" @submit.prevent="postBoardMessage">
          <textarea v-model="boardInput" rows="3" placeholder="将此刻的心境写下来"></textarea>
          <button type="submit">发布留言</button>
        </form>
      </article>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  padding: 1.75rem;
  border-radius: 1.5rem;
  background: var(--gradient-slate);
  box-shadow: 0 40px 60px rgba(6, 20, 40, 0.55);
  color: var(--color-ink-strong);
}

.home-hero h1 {
  font-size: clamp(2.4rem, 4vw, 3.4rem);
  line-height: 1.2;
  margin: 0.4rem 0;
}

.home-hero h1 span {
  display: block;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-accent);
}

.page-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.page-nav a {
  padding: 0.45rem 0.9rem;
  border-radius: 0.8rem;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.15rem;
  color: var(--color-ink-strong);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
}

.page-nav a:hover {
  border-color: rgba(255, 255, 255, 0.4);
}

.hero-sup {
  font-size: 0.9rem;
  letter-spacing: 0.4rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.hero-lead {
  color: rgba(255, 255, 255, 0.8);
  max-width: 44ch;
}

.hero-panel {
  width: min(280px, 100%);
  padding: 1.15rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hero-label {
  font-size: 0.8rem;
  letter-spacing: 0.2rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
}

.hero-value {
  font-size: 1.2rem;
  font-weight: 600;
}

.hero-meta {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.65);
}

.hero-cta {
  margin-top: 0.7rem;
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-ink-solid);
  font-weight: 600;
}

.auth-hint {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.primary {
  padding: 0.6rem 1.3rem;
  border-radius: 0.9rem;
  border: none;
  background: var(--gradient-sage);
  color: var(--color-ink-solid);
  font-weight: 600;
}

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

.dashboard-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
  align-items: stretch;
}

.grid-two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}

.panel {
  padding: 1.5rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 40px rgba(4, 12, 31, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.panel-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.panel .title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.panel .subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.65);
}

.panel .meta {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.status-pill {
  padding: 0.35rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  letter-spacing: 0.15rem;
  text-transform: uppercase;
}

.status-pill.loading {
  border-color: var(--color-accent);
}

.questions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 620px;
  overflow: auto;
}

.question-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.1);
  padding: 0.8rem;
  border-radius: 0.9rem;
}

.question-row p {
  flex: 1;
  margin: 0;
  font-size: 0.9rem;
}

.question-row select {
  min-width: 160px;
  padding: 0.5rem 0.7rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-ink-solid);
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.form-actions button {
  padding: 0.75rem 1.3rem;
  border-radius: 0.9rem;
  border: none;
  background: var(--gradient-sage);
  color: var(--color-ink-solid);
  font-weight: 600;
  cursor: pointer;
}

.score {
  margin: 0;
  font-size: 0.9rem;
}

.error {
  color: #ff7a7a;
  font-size: 0.85rem;
}

.history-table {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.history-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  background: rgba(0, 0, 0, 0.15);
}

.history-score {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.history-severity {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.history-time {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.empty {
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  margin: 0.5rem 0;
}

.therapy-grid {
  display: grid;
  grid-template-columns: minmax(200px, 0.65fr) minmax(200px, 1fr);
  gap: 1rem;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-item {
  text-align: left;
  padding: 0.75rem 0.9rem;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  color: var(--color-ink-strong);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-item small {
  color: rgba(255, 255, 255, 0.6);
}

.session-item.active {
  border-color: var(--color-accent);
}

.input-label {
  font-size: 0.75rem;
  letter-spacing: 0.2rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.session-list input {
  padding: 0.65rem 0.9rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-ink-strong);
}

.session-list input::placeholder {
  color: rgba(247, 249, 251, 0.6);
}

.ghost {
  padding: 0.5rem 1.1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  color: var(--color-ink-strong);
  cursor: pointer;
  font-weight: 600;
}

.chat-column {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.message-board {
  min-height: 220px;
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.message {
  padding: 0.7rem 1rem;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.message--user {
  background: rgba(72, 187, 120, 0.15);
  border-color: rgba(72, 187, 120, 0.35);
}

.message--agent {
  background: rgba(59, 146, 221, 0.15);
  border-color: rgba(59, 146, 221, 0.35);
}

.message-body {
  display: block;
  margin-bottom: 0.35rem;
}

.message-composer textarea {
  width: 100%;
  padding: 0.9rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-ink-strong);
  resize: vertical;
}

.message-composer textarea::placeholder {
  color: rgba(247, 249, 251, 0.6);
}

.message-composer button {
  margin-top: 0.4rem;
  padding: 0.8rem 1.2rem;
  border-radius: 0.9rem;
  border: none;
  background: var(--gradient-sage);
  color: var(--color-ink-solid);
  font-weight: 600;
  cursor: pointer;
}

.message-panel {
  width: 100%;
  padding: 1.5rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 40px rgba(4, 12, 31, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.board-message {
  padding: 0.9rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.board-message-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 0.25rem;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-form textarea {
  width: 100%;
  padding: 0.9rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-ink-strong);
  resize: vertical;
}

.message-form textarea::placeholder {
  color: rgba(247, 249, 251, 0.6);
}

.message-form button {
  align-self: flex-end;
  padding: 0.8rem 1.4rem;
  border-radius: 0.9rem;
  border: none;
  background: var(--gradient-sage);
  color: var(--color-ink-solid);
  font-weight: 600;
  cursor: pointer;
}

.strategy {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.1rem;
}

.knowledge-panel .filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter {
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: var(--color-ink-strong);
  cursor: pointer;
}

.filter.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-ink-solid);
}

.articles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.article-card {
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.article-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1rem;
  color: rgba(255, 255, 255, 0.6);
}

.article-content {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
}

@media (max-width: 900px) {
  .therapy-grid {
    grid-template-columns: 1fr;
  }
  .section-grid {
    grid-template-columns: 1fr;
  }
}
</style>
