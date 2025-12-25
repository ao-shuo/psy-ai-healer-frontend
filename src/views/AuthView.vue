<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const mode = ref<'login' | 'register'>('login')
const message = ref('')
const loginForm = ref({ username: '', password: '' })
const registerForm = ref({
  username: '',
  password: '',
  fullName: '',
  email: '',
  role: 'USER',
  registrationCode: '',
})
const loading = computed(() => authStore.loading)
const roleOptions = [
  { label: '普通用户', value: 'USER' },
  { label: '心理咨询师', value: 'THERAPIST' },
  { label: '管理员', value: 'ADMIN' },
]
const showRegistrationCodeInput = computed(() => registerForm.value.role !== 'USER')

watch(() => registerForm.value.role, (next) => {
  if (next === 'USER') {
    registerForm.value.registrationCode = ''
  }
})

const selectMode = (next: 'login' | 'register') => {
  mode.value = next
  message.value = ''
}

const handleLogin = async () => {
  message.value = ''
  try {
    await authStore.login(loginForm.value)
    message.value = '登录成功，正在跳转…'
    router.push('/').catch(() => {})
  } catch (error) {
    message.value = (error as Error).message
  }
}

const handleRegister = async () => {
  message.value = ''
  try {
    await authStore.register(registerForm.value)
    message.value = '注册成功，正在跳转…'
    router.push('/').catch(() => {})
  } catch (error) {
    message.value = (error as Error).message
  }
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-card">
      <p class="eyebrow">Psy AI Healer</p>
      <h1>专属心理陪伴</h1>
      <p class="lead">
        官方安全接入端口，所有敏感数据通过后端验证。如果已有账号，请登录；若首次体验，注册即刻开始持续陪伴。
      </p>

      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="selectMode('login')">登录</button>
        <button :class="{ active: mode === 'register' }" @click="selectMode('register')">注册</button>
      </div>

      <form v-if="mode === 'login'" class="auth-form" @submit.prevent="handleLogin">
        <label>
          用户名
          <input v-model="loginForm.username" placeholder="例如：mind.yuan" required />
        </label>
        <label>
          密码
          <input type="password" v-model="loginForm.password" placeholder="请输入密码" required />
        </label>
        <button type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
      </form>

      <form v-else class="auth-form" @submit.prevent="handleRegister">
        <label>
          用户名
          <input v-model="registerForm.username" placeholder="命名一个专属 ID" required />
        </label>
        <label>
          密码
          <input type="password" v-model="registerForm.password" placeholder="不少于 8 位" required />
        </label>
        <label>
          姓名
          <input v-model="registerForm.fullName" placeholder="真实姓名" required />
        </label>
        <label>
          电子邮箱
          <input type="email" v-model="registerForm.email" placeholder="接收报告" required />
        </label>
        <label class="identity-field">
          <span>身份</span>
          <div class="identity-select">
            <select v-model="registerForm.role">
              <option v-for="option in roleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span class="identity-pill">{{ roleOptions.find(option => option.value === registerForm.role)?.label }}</span>
          </div>
        </label>
        <label v-if="showRegistrationCodeInput">
          注册码
          <input
            v-model="registerForm.registrationCode"
            :placeholder="registerForm.role === 'ADMIN' ? '管理员注册码' : '心理咨询师注册码'"
            :required="showRegistrationCodeInput"
          />
          <small>拥有正确的注册码才能申请该身份，注册码可从项目配置或管理员处获取。</small>
        </label>
        <button type="submit" :disabled="loading">{{ loading ? '注册中…' : '注册并登录' }}</button>
      </form>

      <p class="message" v-if="message">{{ message }}</p>
    </section>
  </main>
</template>

<style scoped>
.auth-shell {
  min-height: 75vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.auth-card {
  width: min(480px, 100%);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow: 0 25px 45px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.5rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.auth-card h1 {
  margin: 0;
  font-size: 2rem;
}

.lead {
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

.tabs {
  display: flex;
  gap: 0.5rem;
}

.tabs button {
  flex: 1;
  padding: 0.8rem 0;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  cursor: pointer;
}

.tabs button.active {
  background: var(--color-accent);
  color: var(--color-ink-solid);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.auth-form label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 0.3rem;
  color: rgba(255, 255, 255, 0.7);
}

.identity-field span {
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--color-ink-solid);
}

.identity-select {
  position: relative;
  border-radius: 1rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: inset 0 0 0 1px rgba(45, 193, 176, 0.25);
}

.identity-select::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(145deg, rgba(45, 193, 176, 0.35), rgba(125, 214, 255, 0.35));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.identity-select select {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-ink-solid);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.4rem 0.5rem;
  appearance: none;
}

.identity-pill {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  padding: 0.2rem 0.8rem;
  border-radius: 999px;
  background: rgba(45, 193, 176, 0.18);
  color: var(--color-ink-solid);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  pointer-events: none;
}

.auth-form input {
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-ink-solid);
}

.auth-form button {
  margin-top: 0.3rem;
  padding: 0.9rem 1.2rem;
  border-radius: 0.9rem;
  border: none;
  background: var(--gradient-sage);
  color: var(--color-ink-solid);
  font-weight: 600;
  cursor: pointer;
}

.message {
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
}
</style>
