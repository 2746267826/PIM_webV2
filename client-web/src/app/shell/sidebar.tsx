import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { LogOut, Server } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useStatusSummary } from '@/api/version'
import { getApiBase } from '@/lib/apiBase'
import { HEALTH_LABEL, normalizeHealthStatus } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, activeNavPath, type NavItem } from '../nav'

/** 当前生效的 API 地址（跟随 pim:api-base-changed 事件刷新） */
function useCurrentApiBase(): string {
  const [base, setBase] = useState(() => getApiBase())
  useEffect(() => {
    const update = () => setBase(getApiBase())
    window.addEventListener('pim:api-base-changed', update)
    return () => window.removeEventListener('pim:api-base-changed', update)
  }, [])
  return base
}

function NavItemButton({
  item,
  active,
  compact = false,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  compact?: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  if (compact) {
    return (
      <Link
        to={item.to}
        title={item.label}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'mx-auto flex h-9 w-9 items-center justify-center rounded-ctl transition-colors duration-150 outline-none',
          active
            ? 'bg-primary-soft text-primary-hover'
            : 'text-text-3 hover:bg-surface-2 hover:text-text-1',
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </Link>
    )
  }
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex h-9 items-center gap-2.5 rounded-ctl px-2.5 text-[13px] font-medium transition-colors duration-150 outline-none',
        active
          ? 'bg-primary-soft text-primary-hover'
          : 'text-text-2 hover:bg-surface-2 hover:text-text-1',
      )}
    >
      {active && (
        <span
          className="absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-full bg-primary"
          aria-hidden
        />
      )}
      <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.badgeChar && (
        <span className="ml-auto text-[10px] text-text-4">{item.badgeChar}</span>
      )}
    </Link>
  )
}

function SidebarStatusDot() {
  const { data } = useStatusSummary()
  const status = normalizeHealthStatus(data?.status)
  const dotClass = {
    healthy: 'bg-ok',
    warning: 'bg-warn',
    critical: 'bg-crit status-dot-critical',
    unknown: 'bg-neutral',
  }[status]
  return (
    <Link
      to="/status"
      className="flex items-center gap-1.5 rounded-ctl px-1 py-0.5 text-xs text-text-3 transition-colors hover:text-text-1 outline-none"
    >
      <span className={cn('size-2 rounded-full', dotClass)} aria-hidden />
      {data ? HEALTH_LABEL[status] : '状态未知'}
    </Link>
  )
}

function ApiBaseHint() {
  const base = useCurrentApiBase()
  return (
    <Link
      to="/settings/server"
      title={`当前服务器：${base || '本机同源'}（点击修改）`}
      className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-text-4 transition-colors hover:text-text-2 outline-none"
    >
      <Server className="size-3 shrink-0" aria-hidden />
      <span className="mono truncate">{base || '本机同源'}</span>
    </Link>
  )
}

function SidebarContent({
  compact = false,
  onNavigate,
}: {
  compact?: boolean
  onNavigate?: () => void
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = activeNavPath(pathname)

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className={cn('flex h-16 shrink-0 items-center gap-2', compact ? 'justify-center px-0' : 'px-4')}>
        <span className="size-2.5 rounded-full bg-primary" aria-hidden />
        {!compact && <span className="text-base font-semibold tracking-wide text-text-1">PIM</span>}
      </div>

      {/* 导航 */}
      <nav className={cn('flex-1 overflow-y-auto pb-2', compact ? 'px-2' : 'px-4')}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {!compact && (
              <div className="px-2.5 pt-3 pb-1 text-xs font-medium text-text-3">{group.label}</div>
            )}
            <div className={cn(!compact && 'space-y-0.5')}>
              {group.items.map((item) => (
                <NavItemButton
                  key={item.to}
                  item={item}
                  active={active === item.to}
                  compact={compact}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 日历本管理器（P1 阶段接入数据与 CRUD） */}
        {!compact && (
          <div className="mb-1">
            <div className="px-2.5 pt-3 pb-1 text-xs font-medium text-text-3">日历本</div>
            <div className="px-2.5 py-1 text-xs text-text-4">将在日历阶段接入</div>
          </div>
        )}
      </nav>

      {/* 底部：状态点 + 用户 + 服务器 */}
      <div className={cn('shrink-0 border-t border-divider', compact ? 'px-2 py-3' : 'px-4 py-3')}>
        {compact ? (
          <div className="flex flex-col items-center gap-3">
            <SidebarStatusDot />
            <button
              type="button"
              title={`退出登录（${(user?.displayName ?? user?.username) || ''}）`}
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="rounded-ctl p-1.5 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1 outline-none"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <SidebarStatusDot />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-text-1">
                  {user?.displayName || user?.username}
                </div>
                <ApiBaseHint />
              </div>
              <button
                type="button"
                title="退出登录"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="rounded-ctl p-1.5 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-1 outline-none"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export { SidebarContent }
