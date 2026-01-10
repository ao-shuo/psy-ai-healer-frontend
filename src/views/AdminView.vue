<template>
  <section class="admin">
    <header class="admin-header">
      <h1>管理员后台</h1>
      <p class="muted">审核用户、查看用户与资源库文章</p>
    </header>

    <section class="card">
      <div class="card-head">
        <h2>待审核用户</h2>
        <button type="button" class="btn" :disabled="pendingLoading" @click="loadPending">
          {{ pendingLoading ? '加载中…' : '刷新' }}
        </button>
      </div>

      <p v-if="pendingError" class="error">{{ pendingError }}</p>
      <p v-else-if="!pendingLoading && pendingUsers.length === 0" class="muted">暂无待审核用户</p>

      <div v-else class="table">
        <div class="row head">
          <span>ID</span>
          <span>用户名</span>
          <span>角色</span>
          <span>邮箱</span>
          <span>操作</span>
        </div>
        <div v-for="u in pendingUsers" :key="u.id" class="row">
          <span>{{ u.id }}</span>
          <span>{{ u.username }}</span>
          <span>{{ u.role }}</span>
          <span>{{ u.email || '-' }}</span>
          <span>
            <button type="button" class="btn" :disabled="enableLoadingId === u.id" @click="enable(u.id)">
              {{ enableLoadingId === u.id ? '启用中…' : '启用' }}
            </button>
          </span>
        </div>
      </div>
    </section>

    <section class="grid">
      <section class="card">
        <div class="card-head">
          <h2>所有用户</h2>
          <div class="tools">
            <input
              v-model="userQuery"
              class="search"
              type="search"
              placeholder="搜索：用户名/姓名/邮箱"
              @keydown.enter.prevent="loadUsers"
            />
            <button type="button" class="btn" :disabled="usersLoading" @click="loadUsers">
              {{ usersLoading ? '加载中…' : '搜索/刷新' }}
            </button>
          </div>
        </div>
        <p v-if="usersError" class="error">{{ usersError }}</p>
        <div v-else class="table">
          <div class="row head row-users">
            <span>ID</span>
            <span>用户名</span>
            <span>邮箱</span>
            <span>角色</span>
            <span>启用</span>
            <span>操作</span>
          </div>
          <div v-for="u in users" :key="u.id" class="row row-users">
            <span>{{ u.id }}</span>
            <span>{{ u.username }}</span>
            <span>{{ u.email || '-' }}</span>
            <span>{{ u.role }}</span>
            <span>{{ u.enabled ? '是' : '否' }}</span>
            <span>
              <button type="button" class="btn" :disabled="profileLoadingId === u.id" @click="loadProfile(u.id)">
                {{ profileLoadingId === u.id ? '加载画像…' : '画像' }}
              </button>
              <button
                v-if="u.enabled"
                type="button"
                class="btn"
                :disabled="toggleLoadingId === u.id"
                @click="disable(u.id)"
              >
                {{ toggleLoadingId === u.id ? '处理中…' : '禁用' }}
              </button>
              <button
                v-else
                type="button"
                class="btn"
                :disabled="toggleLoadingId === u.id"
                @click="enableFromList(u.id)"
              >
                {{ toggleLoadingId === u.id ? '处理中…' : '启用' }}
              </button>
            </span>
          </div>
        </div>

        <div class="profile" v-if="selectedProfile || profileError">
          <div class="card-head">
            <h3>用户画像</h3>
            <button v-if="selectedProfile" type="button" class="btn" @click="clearProfile">关闭</button>
          </div>

          <p v-if="profileError" class="error">{{ profileError }}</p>

          <div v-else-if="selectedProfile" class="profile-body">
            <div class="profile-grid">
              <div class="kv"><span class="k">用户</span><span class="v">{{ selectedProfile.username }}（ID: {{ selectedProfile.userId }}）</span></div>
              <div class="kv"><span class="k">姓名</span><span class="v">{{ selectedProfile.fullName || '-' }}</span></div>
              <div class="kv"><span class="k">邮箱</span><span class="v">{{ selectedProfile.email || '-' }}</span></div>
              <div class="kv"><span class="k">风险</span><span class="v">{{ selectedProfile.riskLevel || '-' }}</span></div>
              <div class="kv"><span class="k">最近PHQ-9</span><span class="v">{{ selectedProfile.lastPhq9Score ?? '-' }} {{ selectedProfile.lastPhq9Severity ? '（' + selectedProfile.lastPhq9Severity + '）' : '' }}</span></div>
              <div class="kv"><span class="k">最近心情</span><span class="v">{{ selectedProfile.lastMood || '-' }} {{ selectedProfile.lastMoodScore != null ? '（' + selectedProfile.lastMoodScore + '/10）' : '' }}</span></div>
              <div class="kv"><span class="k">偏好语气</span><span class="v">{{ selectedProfile.preferredTone || '-' }}</span></div>
              <div class="kv"><span class="k">更新时间</span><span class="v">{{ formatTime(selectedProfile.updatedAt) }}</span></div>
              <div class="kv"><span class="k">对话推断时间</span><span class="v">{{ formatTime(selectedProfile.lastInsightAt) }}</span></div>
              <div class="kv"><span class="k">置信度</span><span class="v">{{ selectedProfile.insightConfidence != null ? Number(selectedProfile.insightConfidence).toFixed(2) : '-' }}</span></div>
              <div class="kv"><span class="k">沟通风格</span><span class="v">{{ selectedProfile.communicationStyle || '-' }}</span></div>
            </div>

            <div class="block">
              <div class="k">性格/倾向（推断）</div>
              <div class="v pre">{{ selectedProfile.personalityNotes || '-' }}</div>
            </div>

            <div class="block">
              <div class="k">证据（来自对话）</div>
              <div class="v pre">{{ selectedProfile.insightEvidence || '-' }}</div>
            </div>

            <div class="block">
              <div class="k">目标</div>
              <div class="v pre">{{ selectedProfile.goals || '-' }}</div>
            </div>
            <div class="block">
              <div class="k">触发点</div>
              <div class="v pre">{{ selectedProfile.triggers || '-' }}</div>
            </div>
            <div class="block">
              <div class="k">偏好应对方式</div>
              <div class="v pre">{{ selectedProfile.copingPreferences || '-' }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>资源库文章</h2>
          <button type="button" class="btn" :disabled="articlesLoading" @click="loadArticles">
            {{ articlesLoading ? '加载中…' : '刷新' }}
          </button>
        </div>
        <p v-if="articlesError" class="error">{{ articlesError }}</p>
        <div v-else class="table">
          <div class="row head">
            <span>ID</span>
            <span>标题</span>
            <span>分类</span>
            <span>发布</span>
          </div>
          <div v-for="a in articles" :key="a.id" class="row">
            <span>{{ a.id }}</span>
            <span class="truncate" :title="a.title">{{ a.title }}</span>
            <span>{{ a.category || '-' }}</span>
            <span>{{ a.published ? '是' : '否' }}</span>
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

type AdminUser = {
  id: number
  username: string
  email?: string
  role: 'STUDENT' | 'COUNSELOR' | 'ADMIN'
  enabled?: boolean
}

type Article = {
  id: number
  title: string
  category?: string
  published: boolean
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

const pendingUsers = ref<AdminUser[]>([])
const pendingLoading = ref(false)
const pendingError = ref('')
const enableLoadingId = ref<number | null>(null)

const users = ref<AdminUser[]>([])
const usersLoading = ref(false)
const usersError = ref('')
const userQuery = ref('')
const toggleLoadingId = ref<number | null>(null)

const selectedProfile = ref<UserProfileView | null>(null)
const profileError = ref('')
const profileLoadingId = ref<number | null>(null)

const articles = ref<Article[]>([])
const articlesLoading = ref(false)
const articlesError = ref('')

const loadPending = async () => {
  pendingLoading.value = true
  pendingError.value = ''
  try {
    pendingUsers.value = await af('/admin/users/pending')
  } catch (e: any) {
    pendingError.value = e?.response?.data?.message || e?.message || '加载失败'
  } finally {
    pendingLoading.value = false
  }
}

const enable = async (id: number) => {
  enableLoadingId.value = id
  try {
    await af(`/admin/users/${id}/enable`, { method: 'PATCH' })
    await loadPending()
    await loadUsers()
  } catch (e: any) {
    pendingError.value = e?.response?.data?.message || e?.message || '启用失败'
  } finally {
    enableLoadingId.value = null
  }
}

const loadUsers = async () => {
  usersLoading.value = true
  usersError.value = ''
  try {
    const q = userQuery.value.trim()
    users.value = q ? await af('/admin/users', { params: { q } }) : await af('/admin/users')
  } catch (e: any) {
    usersError.value = e?.response?.data?.message || e?.message || '加载失败'
  } finally {
    usersLoading.value = false
  }
}

const formatTime = (iso?: string | null) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const clearProfile = () => {
  selectedProfile.value = null
  profileError.value = ''
}

const loadProfile = async (id: number) => {
  profileLoadingId.value = id
  profileError.value = ''
  try {
    selectedProfile.value = await af(`/admin/users/${id}/profile`)
  } catch (e: any) {
    profileError.value = e?.response?.data?.message || e?.message || '加载画像失败'
  } finally {
    profileLoadingId.value = null
  }
}

const disable = async (id: number) => {
  toggleLoadingId.value = id
  usersError.value = ''
  try {
    await af(`/admin/users/${id}/disable`, { method: 'PATCH' })
    await Promise.all([loadPending(), loadUsers()])
  } catch (e: any) {
    usersError.value = e?.response?.data?.message || e?.message || '禁用失败'
  } finally {
    toggleLoadingId.value = null
  }
}

const enableFromList = async (id: number) => {
  toggleLoadingId.value = id
  usersError.value = ''
  try {
    await af(`/admin/users/${id}/enable`, { method: 'PATCH' })
    await Promise.all([loadPending(), loadUsers()])
  } catch (e: any) {
    usersError.value = e?.response?.data?.message || e?.message || '启用失败'
  } finally {
    toggleLoadingId.value = null
  }
}

const loadArticles = async () => {
  articlesLoading.value = true
  articlesError.value = ''
  try {
    articles.value = await af('/admin/articles')
  } catch (e: any) {
    articlesError.value = e?.response?.data?.message || e?.message || '加载失败'
  } finally {
    articlesLoading.value = false
  }
}

onMounted(async () => {
  if (!auth.isAuthenticated) return
  await Promise.all([loadPending(), loadUsers(), loadArticles()])
})
</script>

<style scoped>
.admin {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.admin-header h1 {
  margin: 0;
}

.muted {
  color: var(--color-ink-muted);
  margin: 0.25rem 0 0;
}

.error {
  color: #b00020;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 980px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card {
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  padding: 1rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.tools {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search {
  width: min(360px, 52vw);
  padding: 0.5rem 0.75rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-ink-strong);
}

.table {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.35rem;
}

.row {
  display: grid;
  grid-template-columns: 72px 1.1fr 0.9fr 1.3fr 120px;
  gap: 0.75rem;
  align-items: center;
  padding: 0.55rem 0.65rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.06);
}

.row-users {
  grid-template-columns: 72px 1.1fr 1.3fr 0.9fr 0.7fr 140px;
}

.row.head {
  font-weight: 700;
  background: rgba(255, 255, 255, 0.12);
}

.btn {
  font-weight: 600;
  padding: 0.45rem 0.75rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-ink-strong);
  cursor: pointer;
}

.row-users .btn {
  margin-right: 0.4rem;
}

.profile {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.profile-body {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

@media (min-width: 980px) {
  .profile-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.06);
}

.k {
  color: var(--color-ink-muted);
}

.v {
  color: var(--color-ink);
}

.block {
  padding: 0.6rem 0.65rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.06);
}

.pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 0.35rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
