<template>
  <section class="container">
    <h1>心理自评中心</h1>
    <form @submit.prevent="submit" class="form">
      <div v-for="index in 9" :key="index" class="form-row">
        <label>第 {{ index }} 题</label>
        <input type="range" min="0" max="3" v-model.number="answers[index - 1]" />
        <span>{{ answers[index - 1] }}</span>
      </div>
      <button type="submit" :disabled="submitting">提交PHQ-9</button>
    </form>
    <div v-if="result" class="result">
      <h2>得分：{{ result.score }}</h2>
      <p>等级：{{ result.severity }}</p>
    </div>
    <section class="history" v-if="history.length">
      <h3>历史记录</h3>
      <ul>
        <li v-for="entry in history" :key="entry.id">
          <strong>{{ new Date(entry.createdAt).toLocaleString() }}</strong> → {{ entry.score }} 分（{{ entry.severity }}）
        </li>
      </ul>
    </section>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/services/api'

const auth = useAuthStore()
const af = authFetch(auth.token)

const answers = ref<number[]>(Array(9).fill(0))
const submitting = ref(false)
const result = ref<{ score: number; severity: string } | null>(null)
const history = ref<any[]>([])

const submit = async () => {
  submitting.value = true
  try {
    const payload = await af('/assessments/phq9', { method: 'POST', body: { answers: answers.value } })
    result.value = payload
n  } finally {
    submitting.value = false
  }
}

const loadHistory = async () => {
  history.value = await af('/assessments/phq9')
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.container { max-width: 640px; margin: 24px auto; }
.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.form-row input { flex: 1; }
.result { margin-top: 24px; padding: 12px; border-radius: 6px; background: #fefefe; }
.history { margin-top: 24px; }
h3 { margin-bottom: 8px; }
</style>
