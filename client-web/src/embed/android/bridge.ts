/*
 * Android 原生桥（03 §6）：
 * window.pimAndroid postMessage 桥，消息类型：
 * - token.request / token.refresh：页 → 原生（内嵌页令牌由原生注入，不落 localStorage）
 * - native.state.request：页 → 原生（原生采集状态，30 秒轮询）
 * - page.report：页 → 原生（页面数据状态回报，30 秒重试）
 *
 * 在 Capacitor 壳中，等价能力由 PimBridge 插件提供（window.pimAndroid 由壳注入）；
 * 浏览器开发环境下走 fetch 模拟，便于本地调试内嵌页布局。
 */

export interface NativeCollectionState {
  continuousCollection: boolean
  triggerReason: string
  nextLocationAt: string | null
  pendingUpload: number
  batteryOptimized: boolean
}

const BRIDGE_TIMEOUTMS = 5_000

interface PimAndroidBridge {
  postMessage: (payload: string) => void
}

interface BridgeMessage {
  type: string
  requestId?: string
  payload?: unknown
}

type PendingResolver = (value: unknown) => void

let seq = 0
const pending = new Map<string, PendingResolver>()

function bridge(): PimAndroidBridge | null {
  return (globalThis as { pimAndroid?: PimAndroidBridge }).pimAndroid ?? null
}

/** 是否运行于 Android 壳内（桥可用） */
export function hasNativeBridge(): boolean {
  return bridge() != null
}

function installReceiver() {
  if ((globalThis as { __pimBridgeInstalled?: boolean }).__pimBridgeInstalled) return
  ;(globalThis as { __pimBridgeInstalled?: boolean }).__pimBridgeInstalled = true
  // 壳通过 window.__pimBridgeReceive(JSON) 回送响应
  ;(globalThis as { __pimBridgeReceive?: (raw: string) => void }).__pimBridgeReceive = (raw: string) => {
    try {
      const msg = JSON.parse(raw) as BridgeMessage
      if (msg.requestId) {
        const resolve = pending.get(msg.requestId)
        pending.delete(msg.requestId)
        resolve?.(msg.payload)
      }
    } catch {
      // 忽略无法解析的消息
    }
  }
}

/** 发送桥消息并等待响应（无桥时返回 null，由调用方回退） */
function call(type: string, payload?: unknown, timeoutMs = BRIDGE_TIMEOUTMS): Promise<unknown | null> {
  const b = bridge()
  if (!b) return Promise.resolve(null)
  installReceiver()
  const requestId = `r${++seq}`
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      resolve(null)
    }, timeoutMs)
    pending.set(requestId, (value) => {
      clearTimeout(timer)
      resolve(value)
    })
    b.postMessage(JSON.stringify({ type, requestId, payload }))
  })
}

/** 请求原生注入令牌（内嵌页不落 localStorage；此处仅返回供 apiFetch 的临时覆盖） */
export async function requestNativeToken(refresh = false): Promise<string | null> {
  const res = await call(refresh ? 'token.refresh' : 'token.request')
  return typeof res === 'string' ? res : ((res as { token?: string } | null)?.token ?? null)
}

/** 原生采集状态（30 秒轮询由调用方驱动） */
export async function requestNativeState(): Promise<NativeCollectionState | null> {
  const res = (await call('native.state.request')) as NativeCollectionState | null
  return res && typeof res === 'object' ? res : null
}

/** 向壳回报页面数据状态（成功/失败/空；壳侧 30 秒重试） */
export function reportPageState(state: 'success' | 'empty' | 'error', detail?: string): void {
  const b = bridge()
  if (!b) return
  installReceiver()
  b.postMessage(JSON.stringify({ type: 'page.report', payload: { state, detail, at: new Date().toISOString() } }))
}

/** 内嵌页 URL 参数（?embed=1 等） */
export function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/embed/') || new URLSearchParams(window.location.search).get('embed') === '1'
}
