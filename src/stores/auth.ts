import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/services/api'

const STORAGE_KEYS = {
  token: 'psy-ai-token',
  username: 'psy-ai-username',
  roles: 'psy-ai-roles',
}

const readStorage = (key: string, fallback = '') => {
  if (typeof window === 'undefined') return fallback
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

const writeStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

const removeStorage = (key: string) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const parseRoles = (value: string) => {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string') as string[]
    }
  } catch {
    // ignore
  }
  return []
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(readStorage(STORAGE_KEYS.token))
  const username = ref(readStorage(STORAGE_KEYS.username))
  const roles = ref(parseRoles(readStorage(STORAGE_KEYS.roles)))
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))

  const persist = () => {
    writeStorage(STORAGE_KEYS.token, token.value)
    writeStorage(STORAGE_KEYS.username, username.value)
    writeStorage(STORAGE_KEYS.roles, JSON.stringify(roles.value))
  }

  const reset = () => {
    token.value = ''
    username.value = ''
    roles.value = []
    removeStorage(STORAGE_KEYS.token)
    removeStorage(STORAGE_KEYS.username)
    removeStorage(STORAGE_KEYS.roles)
  }

  const applyResponse = (payload: { token?: string; username?: string; roles?: unknown }) => {
    token.value = payload.token ?? ''
    username.value = payload.username ?? ''
    const rawRoles = Array.isArray(payload.roles) ? payload.roles.filter((value): value is string => typeof value === 'string') : []
    roles.value = rawRoles
    persist()
  }

  const login = async (form: { username: string; password: string }) => {
    loading.value = true
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: form,
      })
      applyResponse(response ?? {})
    } finally {
      loading.value = false
    }
  }

  const register = async (form: { username: string; password: string; fullName: string; email: string }) => {
    loading.value = true
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: form,
      })
      applyResponse(response ?? {})
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    reset()
  }

  return {
    token,
    username,
    roles,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  }
})
