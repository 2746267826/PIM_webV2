/*
 * API 地址配置（v0.3 计划的结构性新增）。
 * - 存储 localStorage pim.apiBase（协议://主机:端口，不含 /api/v1；空 = 同源）
 * - 所有请求/瓦片/下载 URL 必须经 apiUrl() 拼接，禁止散落拼接
 * - 壳（Capacitor/Tauri）无同源概念：未配置地址时强制进入 /setup
 */
import { STORAGE_KEYS, getJSON, getString, setJSON, setString } from './storage'

const HISTORY_LIMIT = 5

export function getApiBase(): string {
  return (getString(STORAGE_KEYS.apiBase) ?? '').trim().replace(/\/+$/, '')
}

export function getApiBaseHistory(): string[] {
  return getJSON<string[]>(STORAGE_KEYS.apiBaseHistory, [])
}

export function setApiBase(raw: string): void {
  const value = raw.trim().replace(/\/+$/, '')
  if (value) {
    try {
      // 仅接受带协议的绝对地址（同源场景请留空）
      new URL(value)
    } catch {
      throw new Error('地址需包含协议，例如 http://192.168.1.10:5858')
    }
  }
  setString(STORAGE_KEYS.apiBase, value)
  if (value) {
    const rest = getApiBaseHistory().filter((x) => x !== value)
    setJSON(STORAGE_KEYS.apiBaseHistory, [value, ...rest].slice(0, HISTORY_LIMIT))
  }
  // 广播给侧边栏服务器指示等订阅者
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pim:api-base-changed'))
  }
}

/** 拼接 API 相对路径（path 以 / 开头，如 /api/v1/...） */
export function apiUrl(path: string): string {
  const base = getApiBase()
  if (!base) return path
  return path.startsWith('/') ? base + path : `${base}/${path}`
}

/** 用候选地址（而非当前生效地址）拼 URL，供"测试连接"使用 */
export function candidateUrl(base: string, path: string): string {
  const b = base.trim().replace(/\/+$/, '')
  if (!b) return path
  return path.startsWith('/') ? b + path : `${b}/${path}`
}

/** 是否运行在原生壳内（Capacitor / Tauri） */
export function isNativeShell(): boolean {
  const w = globalThis as {
    Capacitor?: { isNativePlatform?: () => boolean }
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown
  }
  return Boolean(w.Capacitor?.isNativePlatform?.()) || Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__)
}

/** 壳内且未配置 API 地址 → 全路由重定向 /setup */
export function needsServerSetup(): boolean {
  return isNativeShell() && !getApiBase()
}
