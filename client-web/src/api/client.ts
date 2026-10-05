/*
 * 全站 HTTP 核心（04 §8 的直接实现）：
 * - Bearer 注入；FormData 不带 JSON 头
 * - 统一解包 { code, message, data }；204 → undefined
 * - 任意请求首个 401 → 共享单次刷新（并发 401 只发起一次）→ 重放一次
 * - HTML 响应识别（SPA fallback 兜底保护）
 * - allowStatuses：Outlook 写回 409/412 走正常解包
 */
import { apiUrl } from '@/lib/apiBase'
import { STORAGE_KEYS, getString, remove, setString } from '@/lib/storage'
import type { ApiResponse } from './types'

export class ApiError extends Error {
  /** 业务错误码（body.code）；非封装响应为 -1 */
  readonly code: number
  /** HTTP 状态码 */
  readonly status: number

  constructor(message: string, code = -1, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function getAccessToken(): string | undefined {
  return getString(STORAGE_KEYS.accessToken) ?? undefined
}

export function getRefreshToken(): string | undefined {
  return getString(STORAGE_KEYS.refreshToken) ?? undefined
}

export function setTokens(accessToken: string, refreshToken: string): void {
  setString(STORAGE_KEYS.accessToken, accessToken)
  setString(STORAGE_KEYS.refreshToken, refreshToken)
}

export function clearTokens(): void {
  remove(STORAGE_KEYS.accessToken)
  remove(STORAGE_KEYS.refreshToken)
}

/** 刷新失败/登出广播（AuthContext 监听后清用户态，路由守卫自动回登录页） */
export function broadcastUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pim:unauthorized'))
  }
}

export interface FetchOptions {
  /** 是否携带 Bearer（默认 true；匿名端点可显式 false） */
  auth?: boolean
  /** 视为"可正常解包业务体"的 HTTP 状态（如 Outlook 写回的 409/412） */
  allowStatuses?: number[]
  signal?: AbortSignal
}

interface RawInit {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

async function rawFetch(path: string, init: RawInit, opts: FetchOptions): Promise<Response> {
  const headers = new Headers(init.headers)
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (init.body !== undefined && !isForm) {
    headers.set('Content-Type', 'application/json')
  }
  if ((opts.auth ?? true) && !headers.has('Authorization')) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(apiUrl(path), {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: isForm
      ? (init.body as FormData)
      : init.body !== undefined
        ? JSON.stringify(init.body)
        : undefined,
    signal: opts.signal,
  })
}

/* ── 401 共享单次刷新 ─────────────────────────────────────── */

let refreshPromise: Promise<boolean> | null = null

/** 测试辅助：复位共享刷新 Promise */
export function resetRefreshState(): void {
  refreshPromise = null
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const body = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>
    if (body.code !== 0) return false
    setTokens(body.data.accessToken, body.data.refreshToken)
    return true
  } catch {
    return false
  }
}

function refreshOnce(): Promise<boolean> {
  refreshPromise ??= doRefresh().finally(() => {
    // 让并发等待者都能拿到同一结果，下一个事件循环后复位
    setTimeout(() => {
      refreshPromise = null
    }, 0)
  })
  return refreshPromise
}

/* ── 核心请求 ─────────────────────────────────────────────── */

export async function apiFetch<T>(
  path: string,
  init: RawInit = {},
  opts: FetchOptions = {},
): Promise<T> {
  const allow = new Set(opts.allowStatuses ?? [])
  let res = await rawFetch(path, init, opts)

  if (res.status === 401 && (opts.auth ?? true) && !allow.has(401)) {
    const refreshed = await refreshOnce()
    if (!refreshed) {
      clearTokens()
      broadcastUnauthorized()
      throw new ApiError('登录已过期，请重新登录', 401, 401)
    }
    res = await rawFetch(path, init, opts)
  }

  /*
   * 429 限流：按 Retry-After（秒，缺省 1）等待后重试一次。
   * 只重试一次且不重放非幂等语义问题——服务端限流本身即幂等保护，重放安全。
   */
  if (res.status === 429 && !allow.has(429)) {
    const retryAfter = Math.min(Number(res.headers.get('retry-after') ?? '1') || 1, 5)
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    res = await rawFetch(path, init, opts)
  }

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (contentType.includes('text/html') || (!contentType.includes('json') && text.trimStart().startsWith('<'))) {
    throw new ApiError('接口返回了 HTML 而非 JSON：服务器地址可能不正确，或后端未启动', -1, res.status)
  }

  let body: unknown = undefined
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new ApiError('响应不是合法 JSON', -1, res.status)
    }
  }

  const statusOk = res.ok || allow.has(res.status)

  if (body != null && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
    const envelope = body as ApiResponse<unknown>
    if (envelope.code !== 0) {
      throw new ApiError(envelope.message || `请求失败（HTTP ${res.status}）`, envelope.code, res.status)
    }
    return envelope.data as T
  }

  // 裸对象端点（/api/version、/api/client/shell/latest 等，非 ApiResponse 封装）
  if (!statusOk) {
    throw new ApiError(`请求失败（HTTP ${res.status}）`, -1, res.status)
  }
  return body as T
}

export function apiGet<T>(path: string, opts?: FetchOptions): Promise<T> {
  return apiFetch<T>(path, {}, opts)
}

export function apiPost<T>(path: string, body: unknown = {}, opts?: FetchOptions): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body }, opts)
}

export function apiPut<T>(path: string, body: unknown = {}, opts?: FetchOptions): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body }, opts)
}

export function apiDelete<T>(path: string, opts?: FetchOptions): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' }, opts)
}

/** multipart 上传 */
export function apiUpload<T>(path: string, form: FormData, opts?: FetchOptions): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: form }, opts)
}

/**
 * 带认证的裸 fetch（Blob 下载通道，03 §5）：
 * 用于 img/iframe 带不了认证头的场景（缩略图、导出 JSON、ICS 等）。
 * 刻意不用 apiFetch 解包——响应是二进制或 302 直链。
 */
export async function fetchBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers: Record<string, string> = {}
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(apiUrl(path), { headers, signal })
  if (!res.ok) {
    throw new ApiError(`下载失败（HTTP ${res.status}）`, -1, res.status)
  }
  return res.blob()
}
