import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, register as apiRegister, getCurrentUser } from '@/services/api'

export interface User {
  id: number
  username: string
  fullName?: string
  email: string
  role: 'STUDENT' | 'COUNSELOR' | 'ADMIN'
  enabled?: boolean
  createdAt?: string | null
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  password: string
  fullName: string
  email: string
  role: 'STUDENT' | 'COUNSELOR' | 'ADMIN'
  registrationCode?: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<User | null>(null)
  const roles = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const username = computed(() => user.value?.username ?? null)
  const isStudent = computed(() => user.value?.role === 'STUDENT' || roles.value.includes('STUDENT'))
  const isCounselor = computed(() => user.value?.role === 'COUNSELOR' || roles.value.includes('COUNSELOR'))
  const isAdmin = computed(() => user.value?.role === 'ADMIN' || roles.value.includes('ADMIN'))

  async function login(credentials: LoginCredentials) {
    try {
      loading.value = true
      error.value = null
      const response = await apiLogin(credentials)

      token.value = response.token
      roles.value = Array.isArray(response.roles) ? response.roles : []
      localStorage.setItem('token', response.token)

      await fetchCurrentUser()
      return true
    } catch (err: any) {
      error.value = err.response?.data?.message || err.response?.data?.error || '登录失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function register(data: RegisterData) {
    try {
      loading.value = true
      error.value = null
      await apiRegister(data)
      return true
    } catch (err: any) {
      error.value = err.response?.data?.message || err.response?.data?.error || '注册失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchCurrentUser() {
    if (!token.value) return
    
    try {
      const userData = await getCurrentUser()
      user.value = userData
      roles.value = userData?.role ? [userData.role] : roles.value
    } catch (err) {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    roles.value = []
    localStorage.removeItem('token')
  }

  return {
    token,
    user,
    roles,
    loading,
    error,
    isAuthenticated,
    username,
    isStudent,
    isCounselor,
    isAdmin,
    login,
    register,
    logout,
    fetchCurrentUser
  }
})