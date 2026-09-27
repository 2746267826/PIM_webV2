import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAdmin, RequireAuth, RequireSetup } from './guards'
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
import { PcTrackerPage } from '@/features/pc/pages/pc-tracker-page'
import { BrowserPage } from '@/features/pc/pages/browser-page'
import { MobileRecordsPage } from '@/features/mobile/pages/mobile-records-page'
import { LocationHistoryPage } from '@/features/mobile/pages/location-history-page'
import { DevicesPage } from '@/features/mobile/pages/devices-page'
import { DeviceDetailPage } from '@/features/mobile/pages/device-detail-page'
import { StatusPage } from '@/features/operations/pages/status-page'
import { FilesPage } from '@/features/files/pages/files-page'
import { MicrosoftPage } from '@/features/settings/microsoft/microsoft-page'
import { AppKnowledgeBasePage, CategoryTreePage } from '@/features/knowledge/pages/app-knowledge-page'
import { EndpointShellPage } from '@/features/endpoints/pages/endpoint-shell-page'
import { AndroidTodayEmbedPage, AndroidTracksEmbedPage } from '@/embed/android/android-embed-pages'
import {
  AdminUsersPage,
  AiSettingsPage,
  CalendarDataManagerPage,
  DataReliabilityPage,
  McpSettingsPage,
  PcDetailQueryPage,
  RecycleBinPage,
} from '@/features/settings/pages/settings-pages'

/** 路由表（对应规格 01 §4 全量路由；P0 先通骨架与设置域，其余为占位页） */
export const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  {
    element: <RequireSetup />,
    children: [
      { path: '/login', element: <LoginPage /> },

      // Android 内嵌页（免认证、无外壳；桥见 src/embed/android/bridge.ts）
      { path: '/embed/android/today', element: <AndroidTodayEmbedPage /> },
      { path: '/embed/android/tracks', element: <AndroidTracksEmbedPage /> },

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
          { path: 'pc-tracker', element: <PcTrackerPage /> },
          { path: 'pc-tracker/browser', element: <BrowserPage /> },
          { path: 'mobile-records', element: <MobileRecordsPage /> },
          { path: 'location-history', element: <LocationHistoryPage /> },

          // ── 收集 ──
          { path: 'quick-notes', element: <QuickNotesPage /> },
          { path: 'files', element: <FilesPage /> },

          // ── 治理 ──
          { path: 'data-center', element: <DataCenterPage /> },
          { path: 'reminders', element: <RemindersPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'habits', element: <HabitsPage /> },

          // ── 系统 ──
          { path: 'status', element: <StatusPage /> },
          { path: 'settings', element: <SettingsHubPage /> },
          { path: 'settings/server', element: <ServerSettingsPage /> },
          { path: 'settings/microsoft', element: <MicrosoftPage /> },
          { path: 'settings/data-reliability', element: <DataReliabilityPage /> },
          { path: 'settings/sync', element: <Navigate to="/settings/microsoft?tab=outlook" replace /> },
          {
            // AI 网关与用户管理为 Admin 专属（ai/admin 组 Roles="admin"），提前拦截避免 403 噪音
            element: <RequireAdmin />,
            children: [
              { path: 'settings/ai', element: <AiSettingsPage /> },
              { path: 'settings/users', element: <AdminUsersPage /> },
            ],
          },
          { path: 'settings/mcp', element: <McpSettingsPage /> },
          { path: 'settings/calendar-data', element: <CalendarDataManagerPage /> },
          { path: 'settings/recycle-bin', element: <RecycleBinPage /> },
          { path: 'settings/pc-data', element: <PcDetailQueryPage /> },

          // ── 其它 ──
          { path: 'app-knowledge-base', element: <AppKnowledgeBasePage /> },
          { path: 'app-knowledge-base/categories', element: <CategoryTreePage /> },
          { path: 'audit/:objectType/:objectId', element: <AuditTimelinePage /> },
          { path: 'endpoint-shell', element: <EndpointShellPage /> },
          { path: 'exhibition', element: <UnderConstruction title="展览馆" subtitle="图表组件陈列馆（P2 阶段实现）" /> },
          { path: 'devices', element: <DevicesPage /> },
          { path: 'devices/:deviceId', element: <DeviceDetailPage /> },

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
