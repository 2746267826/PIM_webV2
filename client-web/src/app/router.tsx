import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth, RequireSetup } from './guards'
import { AppShell } from './shell/app-shell'
import { LoginPage } from '@/features/auth/pages/login-page'
import { SetupPage } from '@/features/server/pages/setup-page'
import { ServerSettingsPage } from '@/features/server/pages/server-settings-page'
import { SettingsHubPage } from '@/features/settings/pages/settings-hub-page'
import { NotFoundPage, UnderConstruction } from '@/features/placeholders/under-construction'
import { CalendarPage } from '@/features/calendar/pages/calendar-page'
import { TasksPage } from '@/features/calendar/pages/tasks-page'
import { TodayPage } from '@/features/today/pages/today-page'
import { ConfirmationsPage } from '@/features/operations/pages/confirmations-page'
import { CalendarStylesPage } from '@/features/calendar/styles/calendar-styles-page'
import { WorkbenchPage } from '@/features/workbench/pages/workbench-page'
import { RemindersPage } from '@/features/calendar/pages/reminders-page'
import { ReportsPage } from '@/features/calendar/pages/reports-page'
import { HabitsPage } from '@/features/calendar/pages/habits-page'
import { QuickNotesPage } from '@/features/quick-notes/pages/quick-notes-page'
import { DataCenterPage } from '@/features/calendar/pages/data-center-page'
import { AuditTimelinePage } from '@/features/operations/pages/audit-timeline-page'

/** 路由表（对应规格 01 §4 全量路由；P0 先通骨架与设置域，其余为占位页） */
export const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  {
    element: <RequireSetup />,
    children: [
      { path: '/login', element: <LoginPage /> },

      // Android 内嵌页（免认证、无外壳；P4 阶段实现）
      {
        path: '/embed/android/*',
        element: (
          <UnderConstruction
            title="Android 内嵌页"
            subtitle="今日 / 轨迹紧凑页与原生桥（P4 阶段实现）"
          />
        ),
      },

      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/today" replace /> },

          // ── 工作 ──
          { path: 'today', element: <TodayPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'calendar-styles', element: <CalendarStylesPage /> },
          { path: 'workbench', element: <WorkbenchPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'confirmations', element: <ConfirmationsPage /> },

          // ── 洞察 ──
          { path: 'pc-tracker', element: <UnderConstruction title="电脑记录" subtitle="PC 活动分析仪表盘（P3 阶段实现）" /> },
          { path: 'pc-tracker/browser', element: <UnderConstruction title="浏览器使用" subtitle="域名使用分析（P3 阶段实现）" /> },
          { path: 'mobile-records', element: <UnderConstruction title="手机记录" subtitle="手机使用分析与设备存活（P3 阶段实现）" /> },
          { path: 'location-history', element: <UnderConstruction title="历史位置" subtitle="GPS 轨迹仪表盘（P3 阶段实现）" /> },

          // ── 收集 ──
          { path: 'quick-notes', element: <QuickNotesPage /> },
          { path: 'files', element: <UnderConstruction title="文件" subtitle="OneDrive 三栏文件浏览器（P4 阶段实现）" /> },

          // ── 治理 ──
          { path: 'data-center', element: <DataCenterPage /> },
          { path: 'reminders', element: <RemindersPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'habits', element: <HabitsPage /> },

          // ── 系统 ──
          { path: 'status', element: <UnderConstruction title="状态" subtitle="系统/组件状态页（P3 阶段实现）" /> },
          { path: 'settings', element: <SettingsHubPage /> },
          { path: 'settings/server', element: <ServerSettingsPage /> },
          { path: 'settings/microsoft', element: <UnderConstruction title="Microsoft 账户" subtitle="Outlook 日历 + OneDrive 文件连接（P4 阶段实现）" /> },
          { path: 'settings/data-reliability', element: <UnderConstruction title="数据可信度" subtitle="13 规则数据体检（P4 阶段实现）" /> },
          { path: 'settings/sync', element: <Navigate to="/settings/microsoft?tab=outlook" replace /> },
          { path: 'settings/ai', element: <UnderConstruction title="AI 设置" subtitle="LiteLLM 状态/用量/请求日志（P4 阶段实现）" /> },
          { path: 'settings/mcp', element: <UnderConstruction title="MCP 设置" subtitle="客户端/令牌/权限管理（P4 阶段实现）" /> },
          { path: 'settings/calendar-data', element: <UnderConstruction title="日程数据管理" subtitle="日程事件批量管理与 ICS 导入导出（P4 阶段实现）" /> },
          { path: 'settings/recycle-bin', element: <UnderConstruction title="回收站" subtitle="日历域回收站与恢复预览（P4 阶段实现）" /> },
          { path: 'settings/pc-data', element: <UnderConstruction title="PC 明细查询" subtitle="PC 原始记录 14 字段明细查询（P4 阶段实现）" /> },
          { path: 'settings/users', element: <UnderConstruction title="用户管理" subtitle="管理员用户/角色管理（P4 阶段实现）" /> },

          // ── 其它 ──
          { path: 'app-knowledge-base', element: <UnderConstruction title="应用知识库" subtitle="应用/域名知识库（P4 阶段实现）" /> },
          { path: 'app-knowledge-base/categories', element: <UnderConstruction title="分类树" subtitle="分类树编辑器（P4 阶段实现）" /> },
          { path: 'audit/:objectType/:objectId', element: <AuditTimelinePage /> },
          { path: 'endpoint-shell', element: <UnderConstruction title="端点外壳" subtitle="设备端点心跳/采集质量调试页（P4 阶段实现）" /> },
          { path: 'exhibition', element: <UnderConstruction title="展览馆" subtitle="图表组件陈列馆（P2 阶段实现）" /> },
          { path: 'devices', element: <UnderConstruction title="设备管理" subtitle="移动设备管理（P3 阶段实现）" /> },
          { path: 'devices/:deviceId', element: <UnderConstruction title="设备详情" subtitle="单设备详情（P3 阶段实现）" /> },

          // ── 旧别名重定向（规格 01 §4） ──
          { path: 'sync', element: <Navigate to="/settings/microsoft?tab=outlook" replace /> },
          { path: 'timeline', element: <Navigate to="/calendar?view=timeline" replace /> },
          { path: 'week', element: <Navigate to="/calendar?view=timeline" replace /> },
          { path: 'month', element: <Navigate to="/calendar?view=month" replace /> },
          { path: 'pc-categories', element: <Navigate to="/app-knowledge-base/categories" replace /> },
          { path: 'pc-classification', element: <Navigate to="/app-knowledge-base" replace /> },

          { path: '*', element: <NotFoundPage /> },
        ],
          },
        ],
      },
    ],
  },
])
