import { Navigate, useLocation } from 'react-router'
import { LazyOutlet } from './lazy-outlet'
import { useAuth } from '@/features/auth/auth-context'
import { needsServerSetup } from '@/lib/apiBase'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { ShieldAlert } from 'lucide-react'

/** 壳内未配置 API 地址 → 强制进入首启向导 */
export function RequireSetup() {
  if (needsServerSetup()) return <Navigate to="/setup" replace />
  return <LazyOutlet />
}

/** 认证守卫：未登录重定向 /login（成功后回跳原 URL） */
export function RequireAuth() {
  const { user, booting, bootError, retryBoot } = useAuth()
  const location = useLocation()

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6" />
      </div>
    )
  }
  /*
   * 引导失败（5xx/网络）≠ 未登录：令牌仍在，不能踢去登录页。
   * 展示可重试的错误页；401 场景 client 已清令牌，bootError 不会置位。
   */
  if (bootError) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <EmptyState
          title="会话恢复失败"
          description="启动时无法连接服务器或服务暂不可用。令牌仍然有效，可稍后重试。"
          action={
            <Button variant="primary" onClick={retryBoot}>
              重试
            </Button>
          }
        />
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
  return <LazyOutlet />
}

/**
 * 管理员守卫：后端 ai 组与 admin 组整体 Roles="admin"（auth-admin-ai.md:3,85,138），
 * 普通用户直接访问会得到 403。此处提前拦截，避免页面刷出一堆无意义的错误请求。
 */
export function RequireAdmin() {
  const { user, booting } = useAuth()

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (user && user.role !== 'admin') {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="需要管理员权限"
        description={`当前账户「${user.displayName || user.username}」为普通用户，无法访问该页面的接口。请使用管理员账户登录。`}
      />
    )
  }
  return <LazyOutlet />
}
