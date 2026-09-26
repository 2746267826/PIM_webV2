import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { needsServerSetup } from '@/lib/apiBase'
import { Spinner } from '@/components/ui'

/** 壳内未配置 API 地址 → 强制进入首启向导 */
export function RequireSetup() {
  if (needsServerSetup()) return <Navigate to="/setup" replace />
  return <Outlet />
}

/** 认证守卫：未登录重定向 /login（成功后回跳原 URL） */
export function RequireAuth() {
  const { user, booting } = useAuth()
  const location = useLocation()

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  return <Outlet />
}
