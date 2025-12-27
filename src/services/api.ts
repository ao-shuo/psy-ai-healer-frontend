import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import type { LoginCredentials, RegisterData } from '@/stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

export type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, unknown>
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：添加 token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// 响应拦截器：处理 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

async function request<T = any>(path: string, options: ApiFetchOptions = {}, token?: string | null): Promise<T> {
  const method = options.method ?? 'GET'
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  const headerToken = token ?? localStorage.getItem('token')
  const headers: Record<string, string> = {
    ...(options.headers ?? {})
  }
  if (headerToken) {
    headers.Authorization = `Bearer ${headerToken}`
  }

  const response = await apiClient.request<T>({
    url: normalizedPath,
    method,
    headers,
    params: options.params,
    data: options.body
  })

  return response.data
}

export function apiFetch() {
  return (path: string, options: ApiFetchOptions = {}) => request(path, options)
}

export function authFetch(token?: string | null) {
  return (path: string, options: ApiFetchOptions = {}) => request(path, options, token)
}

export async function login(credentials: LoginCredentials) {
  const response = await apiClient.post('auth/login', credentials)
  return response.data
}

export async function register(data: RegisterData) {
  const response = await apiClient.post('auth/register', data)
  return response.data
}

export async function getCurrentUser() {
  const response = await apiClient.get('auth/me')
  return response.data
}

export default apiClient