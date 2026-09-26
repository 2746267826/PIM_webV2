import { apiDelete, apiGet, apiPost, apiPut } from '@/api/client'
import type { PagedResult } from '@/api/types'
import type {
  CalendarBook,
  CalendarDeletePreview,
  CalendarOperationResult,
  EventResponse,
  LayerItem,
  TaskBook,
  TaskChecklistItem,
  TaskExecutionSegment,
  TaskResponse,
  TasksPagedParams,
} from './types'

/* ── 日历本 / 任务本 ─────────────────────────────────────── */

export const calendarsApi = {
  list: (kind?: 'calendar' | 'task') =>
    apiGet<CalendarBook[]>(`/api/v1/calendar/calendars${kind ? `?kind=${kind}` : ''}`),
  create: (body: { name: string; color?: string; kind?: string }) =>
    apiPost<CalendarBook>('/api/v1/calendar/calendars', body),
  rename: (id: string, body: { name?: string; color?: string }) =>
    apiPut<CalendarBook>(`/api/v1/calendar/calendars/${id}`, body),
  deletePreview: (id: string) =>
    apiPost<CalendarDeletePreview>(`/api/v1/calendar/calendars/${id}/delete-preview`, {}),
  remove: (id: string) => apiDelete<CalendarOperationResult>(`/api/v1/calendar/calendars/${id}`),
}

export const taskBooksApi = {
  list: () => apiGet<TaskBook[]>('/api/v1/calendar/task-books'),
}

/* ── 日程事件 ─────────────────────────────────────────────── */
/* 双态端点：固定带 page/pageSize 命中 PagedResult 分支（02 §日历网格） */

export const eventsApi = {
  listPaged: (params: { start: string; end: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams({
      start: params.start,
      end: params.end,
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 100),
    })
    return apiGet<PagedResult<EventResponse>>(`/api/v1/calendar/events?${q}`)
  },
  create: (body: Record<string, unknown>) => apiPost<EventResponse>('/api/v1/calendar/events', body),
  update: (
    id: string,
    body: Record<string, unknown>,
    scope?: { scope?: 'this' | 'series'; recurrenceId?: string; originalEventId?: string },
  ) => {
    const q = new URLSearchParams()
    if (scope?.scope) q.set('scope', scope.scope)
    if (scope?.recurrenceId) q.set('recurrenceId', scope.recurrenceId)
    if (scope?.originalEventId) q.set('originalEventId', scope.originalEventId)
    const suffix = q.toString() ? `?${q}` : ''
    return apiPut<EventResponse>(`/api/v1/calendar/events/${id}${suffix}`, body)
  },
  remove: (
    id: string,
    scope?: { scope?: 'this' | 'series'; recurrenceId?: string; originalEventId?: string },
  ) => {
    const q = new URLSearchParams()
    if (scope?.scope) q.set('scope', scope.scope)
    if (scope?.recurrenceId) q.set('recurrenceId', scope.recurrenceId)
    if (scope?.originalEventId) q.set('originalEventId', scope.originalEventId)
    const suffix = q.toString() ? `?${q}` : ''
    return apiDelete<string>(`/api/v1/calendar/events/${id}${suffix}`)
  },
  batchDelete: (ids: string[]) =>
    apiPost<CalendarOperationResult>('/api/v1/calendar/events/batch-delete', { ids }),
}

/* ── 任务 ─────────────────────────────────────────────────── */
/* 双态端点：带筛选/分页参数 → PagedResult；全缺省 → 旧版全量数组 */

function buildTasksQuery(params: TasksPagedParams): string {
  const q = new URLSearchParams()
  if (params.inbox !== undefined) q.set('inbox', String(params.inbox))
  if (params.search) q.set('search', params.search)
  if (params.calendarId) q.set('calendarId', params.calendarId)
  if (params.status) q.set('status', params.status)
  if (params.priority !== undefined) q.set('priority', String(params.priority))
  if (params.plannedFrom) q.set('plannedFrom', params.plannedFrom)
  if (params.plannedTo) q.set('plannedTo', params.plannedTo)
  if (params.dueFrom) q.set('dueFrom', params.dueFrom)
  if (params.dueTo) q.set('dueTo', params.dueTo)
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  return q.toString()
}

export const tasksApi = {
  listPaged: (params: TasksPagedParams) => {
    const q = buildTasksQuery(params)
    return apiGet<PagedResult<TaskResponse>>(`/api/v1/calendar/tasks${q ? `?${q}` : ''}`)
  },
  /** 旧版全量（收件箱侧板用全量+客户端过滤） */
  listAll: (params: { inbox?: boolean } = {}) => {
    const q = params.inbox !== undefined ? `?inbox=${params.inbox}` : ''
    return apiGet<TaskResponse[]>(`/api/v1/calendar/tasks${q}`)
  },
  create: (body: Record<string, unknown>) => apiPost<TaskResponse>('/api/v1/calendar/tasks', body),
  update: (id: string, body: Record<string, unknown>) =>
    apiPut<TaskResponse>(`/api/v1/calendar/tasks/${id}`, body),
  remove: (id: string) =>
    apiDelete<CalendarOperationResult>(`/api/v1/calendar/tasks/${id}`),
  batchDelete: (ids: string[]) =>
    apiPost<CalendarOperationResult>('/api/v1/calendar/tasks/batch-delete', { ids }),
  /** 拖放排期（收件箱任务拖到日历时间槽） */
  plan: (id: string, body: { plannedStart: string; plannedEnd?: string; estimatedDuration?: string }) =>
    apiPost<TaskResponse>(`/api/v1/calendar/tasks/${id}/plan`, body),
}

/* ── 任务清单 / 时间段 ────────────────────────────────────── */

export const checklistApi = {
  add: (taskId: string, body: { title: string; sortOrder?: number }) =>
    apiPost<TaskChecklistItem>(`/api/v1/calendar/tasks/${taskId}/checklist`, body),
  update: (taskId: string, itemId: string, body: { title?: string; isDone?: boolean }) =>
    apiPut<TaskChecklistItem>(`/api/v1/calendar/tasks/${taskId}/checklist/${itemId}`, body),
  remove: (taskId: string, itemId: string) =>
    apiDelete<string>(`/api/v1/calendar/tasks/${taskId}/checklist/${itemId}`),
}

export const segmentsApi = {
  list: (taskId: string) =>
    apiGet<TaskExecutionSegment[]>(`/api/v1/calendar/tasks/${taskId}/segments`),
  add: (taskId: string, body: { startsAt: string; endsAt: string; status: string; source: string }) =>
    apiPost<TaskExecutionSegment>(`/api/v1/calendar/tasks/${taskId}/segments`, body),
}

/* ── 图层（工作台/日历统一查询） ──────────────────────────── */

export const layersApi = {
  list: (params: {
    start: string
    end: string
    layers?: string
    outlookOnly?: boolean
  }) => {
    const q = new URLSearchParams({ start: params.start, end: params.end })
    if (params.layers) q.set('layers', params.layers)
    if (params.outlookOnly) q.set('outlookOnly', 'true')
    return apiGet<{ start: string; end: string; items: LayerItem[] }>(
      `/api/v1/calendar/layers?${q}`,
    )
  },
}

/* ── 排程引擎（收件箱"一键重排"：纯内存计算，返回建议槽位） ── */

export interface ScheduleSlot {
  taskId: string
  title: string
  start: string
  end: string
}

export const scheduleApi = {
  run: (taskIds: string[]) =>
    apiPost<{ algorithmName: string; slots: ScheduleSlot[]; metrics: Record<string, unknown> }>(
      '/api/v1/calendar/schedule',
      { taskIds },
    ),
}
