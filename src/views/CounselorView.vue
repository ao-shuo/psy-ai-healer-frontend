<template>
  <section class="counselor">
    <header class="counselor-header">
      <h1>咨询师工作台</h1>
      <p class="muted">查看告警、浏览学生测评记录</p>
    </header>

    <section class="grid">
      <section class="card">
        <div class="card-head">
          <h2>风险告警（待处理）</h2>
          <button type="button" class="btn" :disabled="alertsLoading" @click="loadAlerts">
            {{ alertsLoading ? '加载中…' : '刷新' }}
          </button>
        </div>

        <p v-if="alertsError" class="error">{{ alertsError }}</p>
        <p v-else-if="!alertsLoading && alerts.length === 0" class="muted">暂无待处理告警</p>

        <div v-else class="table">
          <div class="row head row-alerts">
            <span>ID</span>
            <span>学生</span>
            <span>来源</span>
            <span>分数</span>
            <span>内容</span>
            <span>时间</span>
            <span>操作</span>
          </div>
          <div v-for="a in alerts" :key="a.id" class="row row-alerts">
            <span>{{ a.id }}</span>
            <span>{{ a.user?.username || '-' }}</span>
            <span>{{ a.source }}</span>
            <span>{{ a.score ?? '-' }}</span>
            <span class="truncate" :title="a.message">{{ a.message }}</span>
            <span>{{ formatDate(a.createdAt) }}</span>
            <span>
              <button type="button" class="btn" :disabled="resolveLoadingId === a.id" @click="resolveAlert(a.id)">
                {{ resolveLoadingId === a.id ? '处理中…' : '标记已处理' }}
              </button>
            </span>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>PHQ-9 测评记录</h2>
          <div class="tools">
            <input v-model.number="limit" class="search" type="number" min="1" step="1" placeholder="显示条数" />
            <button type="button" class="btn" :disabled="assessLoading" @click="loadAssessments">
              {{ assessLoading ? '加载中…' : '刷新' }}
            </button>
          </div>
        </div>

        <p v-if="assessError" class="error">{{ assessError }}</p>

        <div v-else class="table">
          <div class="row head row-assess">
            <span>ID</span>
            <span>学生</span>
            <span>分数</span>
            <span>程度</span>
            <span>时间</span>
            <span>操作</span>
          </div>
          <div v-for="r in assessments" :key="r.id" class="row row-assess">
            <span>{{ r.id }}</span>
            <span>{{ r.user?.username || '-' }}</span>
            <span>{{ r.score }}</span>
            <span>{{ r.severity }}</span>
            <span>{{ formatDate(r.createdAt) }}</span>
            <span>
              <div class="ops">
                <button
                  type="button"
                  class="btn"
                  :disabled="!r.user?.id || profileLoadingUserId === r.user?.id"
                  @click="r.user?.id && loadProfile(r.user.id)"
                >
                  {{ profileLoadingUserId === r.user?.id ? '加载画像…' : '画像' }}
                </button>
                <button type="button" class="btn" :disabled="detailLoadingId === r.id" @click="toggleDetail(r.id)">
                  {{ expandedId === r.id ? '收起' : detailLoadingId === r.id ? '加载中…' : '查看' }}
                </button>
              </div>
            </span>
          </div>

          <div v-if="expandedId" class="detail">
            <p class="muted" v-if="detailLoading">加载详情中…</p>
            <p class="error" v-else-if="detailError">{{ detailError }}</p>
            <div v-else-if="detail" class="detail-box">
              <p><b>学生：</b>{{ detail.user?.username || '-' }}（{{ detail.user?.fullName || '-' }}）</p>
              <p><b>分数：</b>{{ detail.score }} / <b>程度：</b>{{ detail.severity }}</p>
              <p><b>答案：</b></p>
              <pre class="answers">{{ detail.answers }}</pre>
            </div>
          </div>

          <div class="detail" v-if="selectedProfile || profileError">
            <p class="error" v-if="profileError">{{ profileError }}</p>
            <div v-else-if="selectedProfile" class="detail-box">
              <div class="card-head" style="margin: 0 0 0.5rem;">
                <h3 style="margin: 0;">用户画像</h3>
                <button type="button" class="btn" @click="clearProfile">关闭</button>
              </div>
              <p><b>用户：</b>{{ selectedProfile.username }}（ID: {{ selectedProfile.userId }}）</p>
              <p><b>姓名：</b>{{ selectedProfile.fullName || '-' }} / <b>邮箱：</b>{{ selectedProfile.email || '-' }}</p>
              <p><b>风险等级：</b>{{ selectedProfile.riskLevel || '-' }}</p>
              <p><b>对话推断时间：</b>{{ formatDate(selectedProfile.lastInsightAt || '') }}</p>
              <p><b>置信度：</b>{{ selectedProfile.insightConfidence != null ? Number(selectedProfile.insightConfidence).toFixed(2) : '-' }}</p>
              <p><b>沟通风格：</b>{{ selectedProfile.communicationStyle || '-' }}</p>
              <p><b>性格/倾向（推断）：</b></p>
              <pre class="answers">{{ selectedProfile.personalityNotes || '-' }}</pre>
              <p><b>证据（来自对话）：</b></p>
              <pre class="answers">{{ selectedProfile.insightEvidence || '-' }}</pre>
              <p>
                <b>最近PHQ-9：</b>{{ selectedProfile.lastPhq9Score ?? '-' }}
                {{ selectedProfile.lastPhq9Severity ? '（' + selectedProfile.lastPhq9Severity + '）' : '' }}
              </p>
              <p>
                <b>最近心情：</b>{{ selectedProfile.lastMood || '-' }}
                {{ selectedProfile.lastMoodScore != null ? '（' + selectedProfile.lastMoodScore + '/10）' : '' }}
              </p>
              <p><b>偏好语气：</b>{{ selectedProfile.preferredTone || '-' }}</p>
              <p><b>目标：</b></p>
              <pre class="answers">{{ selectedProfile.goals || '-' }}</pre>
              <p><b>触发点：</b></p>
              <pre class="answers">{{ selectedProfile.triggers || '-' }}</pre>
              <p><b>偏好应对方式：</b></p>
              <pre class="answers">{{ selectedProfile.copingPreferences || '-' }}</pre>
            </div>
          </div>
        </div>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/services/api'

type BasicUser = {
  id: number
  username: string
  fullName?: string
  email?: string
}

type Alert = {
  id: number
  type: string
  source: string
  message: string
  score?: number | null
  createdAt: string
  status: 'PENDING' | 'RESOLVED'
  user?: BasicUser
}

type Phq9Assessment = {
  id: number
  score: number
  severity: string
  answers: string
  createdAt: string
  user?: BasicUser
}

type UserProfileView = {
  userId: number
  username: string
  fullName?: string | null
  email?: string | null
  role?: string | null
  enabled: boolean

  profileId: number
  lastPhq9Score?: number | null
  lastPhq9Severity?: string | null
  lastPhq9At?: string | null

  lastMood?: string | null
  lastMoodScore?: number | null
  lastMoodAt?: string | null

  preferredTone?: string | null
  goals?: string | null
  triggers?: string | null
  copingPreferences?: string | null

  riskLevel?: string | null
  updatedAt?: string | null

  communicationStyle?: string | null
  personalityNotes?: string | null
  insightEvidence?: string | null
  insightConfidence?: number | null
  lastInsightAt?: string | null
}

const auth = useAuthStore()
const af = authFetch(auth.token)

const alerts = ref<Alert[]>([])
const alertsLoading = ref(false)
const alertsError = ref('')
const resolveLoadingId = ref<number | null>(null)

const assessments = ref<Phq9Assessment[]>([])
const assessLoading = ref(false)
const assessError = ref('')
const limit = ref<number | null>(20)

const expandedId = ref<number | null>(null)
const detail = ref<Phq9Assessment | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailLoadingId = ref<number | null>(null)

const selectedProfile = ref<UserProfileView | null>(null)
const profileError = ref('')
const profileLoadingUserId = ref<number | null>(null)

const formatDate = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

const loadAlerts = async () => {
  alertsLoading.value = true
  alertsError.value = ''
  try {
    alerts.value = await af('/counselor/alerts')
  } catch (e: any) {
    alertsError.value = e?.response?.data?.message || e?.message || '加载失败'
  } finally {
    alertsLoading.value = false
  }
}

const resolveAlert = async (id: number) => {
  resolveLoadingId.value = id
  alertsError.value = ''
  try {
    await af(`/counselor/alerts/${id}/resolve`, { method: 'PATCH' })
    await loadAlerts()
  } catch (e: any) {
    alertsError.value = e?.response?.data?.message || e?.message || '处理失败'
  } finally {
    resolveLoadingId.value = null
  }
}

const loadAssessments = async () => {
  assessLoading.value = true
  assessError.value = ''
  try {
    const l = limit.value ?? undefined
    assessments.value = await af('/counselor/assessments', { params: l ? { limit: l } : undefined })
  } catch (e: any) {
    assessError.value = e?.response?.data?.message || e?.message || '加载失败'
  } finally {
    assessLoading.value = false
  }
}

const toggleDetail = async (id: number) => {
  if (expandedId.value === id) {
    expandedId.value = null
    detail.value = null
    detailError.value = ''
    return
  }

  expandedId.value = id
  detail.value = null
  detailError.value = ''
  detailLoading.value = true
  detailLoadingId.value = id
  try {
    detail.value = await af(`/counselor/assessments/${id}`)
  } catch (e: any) {
    detailError.value = e?.response?.data?.message || e?.message || '加载详情失败'
  } finally {
    detailLoading.value = false
    detailLoadingId.value = null
  }
}

const clearProfile = () => {
  selectedProfile.value = null
  profileError.value = ''
}

const loadProfile = async (userId: number) => {
  profileLoadingUserId.value = userId
  profileError.value = ''
  try {
    selectedProfile.value = await af(`/counselor/users/${userId}/profile`)
  } catch (e: any) {
    profileError.value = e?.response?.data?.message || e?.message || '加载画像失败'
  } finally {
    profileLoadingUserId.value = null
  }
}

onMounted(async () => {
  if (!auth.isAuthenticated) return
  await Promise.all([loadAlerts(), loadAssessments()])
})
</script>

<style scoped>
.counselor {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.counselor-header h1 {
  margin: 0;
}

.muted {
  color: var(--color-ink-muted);
  margin: 0.25rem 0 0;
}

.error {
  color: var(--color-danger, #b00020);
  margin: 0.5rem 0;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card {
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.tools {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn {
  font-weight: 600;
  padding: 0.55rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-ink-strong);
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search {
  width: 10rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-ink-strong);
}

.table {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.row {
  display: grid;
  gap: 0.75rem;
  align-items: center;
  padding: 0.55rem 0.65rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.06);
}

.row.head {
  background: rgba(255, 255, 255, 0.12);
  font-weight: 700;
}

.row-alerts {
  grid-template-columns: 0.5fr 1fr 1fr 0.7fr 2fr 1.2fr 1.1fr;
}

.row-assess {
  grid-template-columns: 0.6fr 1fr 0.7fr 1fr 1.2fr 0.9fr;
}

.ops {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.detail {
  margin-top: 0.75rem;
}

.detail-box {
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.answers {
  margin: 0.5rem 0 0;
  padding: 0.6rem;
  border-radius: 0.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border-1);
  overflow: auto;
}
</style>
