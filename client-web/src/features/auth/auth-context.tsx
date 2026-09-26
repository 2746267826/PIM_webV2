import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/api/auth'
import type { RegisterPayload } from '@/api/auth'
import { clearTokens, getAccessToken, setTokens } from '@/api/client'
import type { UserInfo } from '@/api/types'

interface AuthContextValue {
  user: UserInfo | null
  /** 启动期会话恢复中（GET /auth/me 进行时） */
  booting: boolean
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  /** 纯客户端清令牌（规格：登出无服务端调用） */
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!getAccessToken()) {
        setBooting(false)
        return
      }
      try {
        const me = await authApi.me()
        if (!cancelled) setUser(me)
      } catch {
        // 401 时 client 已清令牌并广播；其余错误按未登录处理
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    void boot()
    const onUnauthorized = () => setUser(null)
    window.addEventListener('pim:unauthorized', onUnauthorized)
    return () => {
      cancelled = true
      window.removeEventListener('pim:unauthorized', onUnauthorized)
    }
  }, [])

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
    () => ({ user, booting, login, register, logout }),
    [user, booting, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
