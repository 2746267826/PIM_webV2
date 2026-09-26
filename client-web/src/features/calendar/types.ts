import type { PagedResult } from '@/api/types'

/* ── 日历本 / 任务本 ─────────────────────────────────────── */

export interface CalendarBook {
  id: string
  name: string
  color: string
  kind: 'calendar' | 'task'
  isDefault: boolean
  eventCount: number
  source: string
  outlookCalendarBindingId: string | null
  canEdit: boolean
}

export interface TaskBook {
  id: string
  domainProjectId: string | null
  name: string
  kind: string
  status: string
  taskCount: number
}

/* ── 日程事件（EventResponse，字段按 05/calendar.md §日程事件） ── */

export interface EventPerson {
  name?: string
  email?: string
  /** 参会人类型（规格 attendees：type 默认 required） */
  type?: string
}

export interface EventResponse {
  id: string
  calendarId: string
  uid: string
  title: string
  description: string | null
  location: string | null
  dtStart: string
  dtEnd: string
  rrule: string | null
  status: string
  source: string
  originalEventId: string | null
  isAllDay: boolean
  timeZoneId: string | null
  sourceTimeZoneId: string | null
  sourceUid: string | null
  recurrenceId: string | null
  descriptionFormat: string | null
  showAs: string | null
  importance: string | null
  sensitivity: string | null
  categories: string[] | null
  isReminderOn: boolean | null
  reminderMinutesBeforeStart: number | null
  organizer: EventPerson | null
  attendees: EventPerson[] | null
  isOnlineMeeting: boolean | null
  onlineMeetingProvider: string | null
  onlineMeetingUrl: string | null
  externalLink: string | null
  isSeriesMaster: boolean
  isException: boolean
  seriesMasterId: string | null
  isCancelled: boolean
  outlookCalendarBindingId: string | null
  outlookEventId: string | null
  outlookEtag: string | null
  outlookEventType: string | null
}

/** Outlook 镜像事件（source 以 outlook 开头）走写回通道而非直接 PUT/DELETE */
export function isOutlookEvent(e: Pick<EventResponse, 'source'>): boolean {
  return e.source.startsWith('outlook')
}

/* ── 任务（TaskResponse） ─────────────────────────────────── */

export interface TaskResponse {
  id: string
  calendarId: string | null
  uid: string
  title: string
  description: string | null
  priority: number
  estimatedDuration: string | null
  minimumSegment: string | null
  dtStart: string | null
  due: string | null
  status: string
  isInbox: boolean
  sortOrder: number
  subTasks: TaskResponse[]
  plannedEnd: string | null
  taskBookId: string | null
  percentComplete: number
  /** 前端可选声明；后端 TaskResponse 不返回（05/calendar.md 备注） */
  checklistItems?: TaskChecklistItem[]
}

export const TASK_STATUS = {
  needsAction: 'NEEDS-ACTION',
  completed: 'COMPLETED',
} as const

/* ── 图层（五层合一） ─────────────────────────────────────── */

export type LayerName = 'events' | 'task-segments' | 'habits' | 'availability' | 'ai-placeholders'

export interface LayerItem {
  id: string
  layer: LayerName
  objectType: string
  objectId: string
  title: string
  startsAt: string
  endsAt: string
  source: string
  status: string
  color: string
  requiresConfirmation: boolean
}

/* ── 任务清单 / 时间段 ────────────────────────────────────── */

export interface TaskChecklistItem {
  id: string
  taskId: string
  title: string
  isDone: boolean
  sortOrder: number
}

export interface TaskExecutionSegment {
  id: string
  taskId: string
  taskTitle: string
  startsAt: string
  endsAt: string
  status: string
  source: string
  planningReason: string | null
  confirmationId: string | null
}

/* ── 操作结果 / 删除预览 ─────────────────────────────────── */

export interface CalendarOperationSample {
  id: string
  type: string
  title: string
  start: string | null
  end: string | null
  bookName: string | null
}

export interface CalendarOperationResult {
  operation: string
  operationId: string
  affectedCount: number
  affectedIds: string[]
  samples: CalendarOperationSample[]
  message: string
}

export interface CalendarDeletePreview {
  targetType: string
  targetId: string
  title: string
  operationKind: string
  affectedCount: number
  samples: CalendarOperationSample[]
  summary: string
  requiresStrictConfirmation: boolean
}

/* ── Outlook 写回（409/412 冲突语义在 data 内） ───────────── */

export interface OutlookWriteResult {
  status: 'created' | 'updated' | 'deleted' | 'conflict' | 'reauth-required' | 'error'
  event: EventResponse | null
  latestEvent: EventResponse | null
  latestEtag: string | null
  errorCode: string | null
  errorMessage: string | null
}

/* ── 查询参数 ─────────────────────────────────────────────── */

export interface EventsRangeParams {
  start: string
  end: string
}

export interface TasksPagedParams {
  inbox?: boolean
  search?: string
  calendarId?: string
  status?: string
  priority?: number
  plannedFrom?: string
  plannedTo?: string
  dueFrom?: string
  dueTo?: string
  page?: number
  pageSize?: number
}

export type { PagedResult }
