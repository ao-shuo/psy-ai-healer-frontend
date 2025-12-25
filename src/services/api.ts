const resolveBase = (base?: string) => (base ?? '/api').replace(/\\/g, '/').replace(/\/$/, '')
const API_BASE = resolveBase(import.meta.env.VITE_API_BASE_URL)

const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`)

const parseBody = async (response: Response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const mergedHeaders = { ...defaultHeaders, ...(options.headers ?? {}) }
  const request: RequestInit = {
    ...options,
    headers: mergedHeaders,
  }

  if (options.body && typeof options.body !== 'string') {
    request.body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE}${normalizePath(path)}`, request)
  const payload = await parseBody(response)
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? (payload as Record<string, unknown>).message
      : null
    throw new Error((message as string) ?? response.statusText ?? '请求失败')
  }

  return payload
}

export function authFetch(token?: string) {
  return (path: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('尚未登录')
    }
    const mergeHeaders = {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    }
    return apiFetch(path, { ...options, headers: mergeHeaders })
  }
}
