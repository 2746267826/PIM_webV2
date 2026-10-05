import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/api/auth'
import type { RegisterPayload } from '@/api/auth'
import { ApiError, clearTokens, getAccessToken, setTokens } from '@/api/client'
import type { UserInfo } from '@/api/types'

interface AuthContextValue {
  user: UserInfo | null
  /** 启动期会话恢复中（GET /auth/me 进行时） */
  booting: boolean
  /**
   * 启动期会话恢复失败（非 401 的 5xx/网络错误）。
   * 与「未登录」区分：未登录跳登录页；bootError 展示可重试的错误页，
   * 否则一次瞬时 500 就会把已登录用户误踢到登录页。
   */
  bootError: boolean
  retryBoot: () => void
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  /** 纯客户端清令牌（规格：登出无服务端调用） */
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootNonce, setBootNonce] = useState(0)

  const [bootError, setBootError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      setBootError(false)
      setBooting(true)
      if (!getAccessToken()) {
        setBooting(false)
        return
      }
      try {
        const me = await authApi.me()
        if (!cancelled) setUser(me)
      } catch (err) {
        // 401 时 client 已清令牌并广播 → 未登录；
        // 其余（5xx/网络）不能当成未登录：保留令牌并标记引导失败，等待重试。
        const status = err instanceof ApiError ? err.status : -1
        if (!cancelled) {
          if (status === 401) setUser(null)
          else setBootError(true)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootNonce 变化重放引导
    void boot()
    const onUnauthorized = () => setUser(null)
    window.addEventListener('pim:unauthorized', onUnauthorized)
    return () => {
      cancelled = true
      window.removeEventListener('pim:unauthorized', onUnauthorized)
    }
  }, [bootNonce])

  const retryBoot = useCallback(() => setBootNonce((n) => n + 1), [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    setTokens(res.accessToken, res.refreshToken)
    setUser(res.user)
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await authApi.register(payload)
    setTokens(res.accessToken, res.refreshToken)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, booting, bootError, retryBoot, login, register, logout }),
    [user, booting, bootError, retryBoot, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
