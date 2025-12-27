<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2 class="auth-title">{{ isLogin ? '登录' : '注册' }} - 心理AI疗愈平台</h2>
      
      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- 用户名 -->
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            required
            placeholder="请输入用户名"
          />
        </div>

        <!-- 密码 -->
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            required
            placeholder="请输入密码"
          />
        </div>

        <!-- 注册额外字段 -->
        <template v-if="!isLogin">
          <div class="form-group">
            <label for="fullName">姓名</label>
            <input
              id="fullName"
              v-model="formData.fullName"
              type="text"
              required
              placeholder="请输入姓名"
            />
          </div>

          <div class="form-group">
            <label for="email">邮箱</label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              required
              placeholder="请输入邮箱"
            />
          </div>

          <div class="form-group">
            <label for="role">角色</label>
            <select id="role" v-model="formData.role" required>
              <option value="STUDENT">学生用户</option>
              <option value="COUNSELOR">心理咨询师</option>
              <option value="ADMIN">系统管理员</option>
            </select>
          </div>

          <div v-if="formData.role !== 'STUDENT'" class="form-group">
            <label for="registrationCode">注册码</label>
            <input
              id="registrationCode"
              v-model="formData.registrationCode"
              type="text"
              required
              placeholder="请输入管理员提供的注册码"
            />
          </div>
        </template>

        <!-- 错误提示 -->
        <div v-if="authStore.error" class="error-message">
          {{ authStore.error }}
        </div>

        <!-- 提交按钮 -->
        <button type="submit" class="submit-btn" :disabled="authStore.loading">
          {{ authStore.loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>

      <!-- 切换登录/注册 -->
      <div class="auth-footer">
        <button @click="toggleMode" class="toggle-btn">
          {{ isLogin ? '还没有账号？去注册' : '已有账号？去登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLogin = ref(true)
const formData = reactive({
  username: '',
  password: '',
  fullName: '',
  email: '',
  role: 'STUDENT' as 'STUDENT' | 'COUNSELOR' | 'ADMIN',
  registrationCode: ''
})

function toggleMode() {
  isLogin.value = !isLogin.value
  // 清空表单
  Object.assign(formData, {
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 'STUDENT',
    registrationCode: ''
  })
}

async function handleSubmit() {
  try {
    if (isLogin.value) {
      await authStore.login({
        username: formData.username,
        password: formData.password
      })
      
      // 根据角色跳转到不同页面
      const role = authStore.user?.role ?? (authStore.roles.length ? authStore.roles[0] : null)
      if (role === 'ADMIN') {
        router.push('/admin')
      } else if (role === 'COUNSELOR') {
        router.push('/counselor')
      } else {
        router.push('/home')
      }
    } else {
      await authStore.register(formData)
      alert(formData.role === 'STUDENT' ? '注册成功，请登录' : '注册成功，请等待管理员审核')
      toggleMode()
    }
  } catch (error) {
    console.error('认证失败:', error)
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.auth-title {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
}

.error-message {
  color: #e74c3c;
  background: #ffe5e5;
  padding: 0.75rem;
  border-radius: 5px;
  text-align: center;
}

.submit-btn {
  padding: 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.submit-btn:hover:not(:disabled) {
  background: #5568d3;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.auth-footer {
  margin-top: 1rem;
  text-align: center;
}

.toggle-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
}
</style>