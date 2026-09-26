/* P0/P1 视觉走查用 mock API：登录/会话/状态/版本 + 日历域 + 确认中心 + 今日分区 */
import { createServer } from 'node:http'

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const ok = (res, data) => json(res, 200, { code: 0, message: 'ok', data, timestamp: new Date().toISOString() })
const paged = (res, items) =>
  ok(res, { items, totalCount: items.length, page: 1, pageSize: 100, totalPages: 1 })

const USER = { id: 'u1', username: 'demo', displayName: '演示用户', role: 'admin' }
const TOKENS = () => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  user: USER,
})

/* ── mock 数据 ─────────────────────────────────────────── */

const CAL_BOOKS = [
  { id: 'cal-1', name: '工作', color: '#3B82F6', kind: 'calendar', isDefault: true, eventCount: 3, source: 'manual', outlookCalendarBindingId: null, canEdit: true },
  { id: 'cal-2', name: '生活', color: '#22C55E', kind: 'calendar', isDefault: false, eventCount: 1, source: 'manual', outlookCalendarBindingId: null, canEdit: true },
]
const TASK_BOOKS = [
  { id: 'tb-1', domainProjectId: null, name: '收集箱', kind: 'task', status: 'Active', taskCount: 2 },
  { id: 'tb-2', domainProjectId: null, name: '本周', kind: 'task', status: 'Active', taskCount: 2 },
]

const at = (h, m = 0) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const plusDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

const EVENTS = [
  { id: 'e1', calendarId: 'cal-1', uid: 'e1@pim', title: '晨会', description: null, location: '301', dtStart: at(9), dtEnd: at(9, 30), rrule: null, status: 'CONFIRMED', source: 'manual', originalEventId: null, isAllDay: false, timeZoneId: null, sourceTimeZoneId: null, sourceUid: null, recurrenceId: null, descriptionFormat: 'text', showAs: null, importance: 'high', sensitivity: null, categories: null, isReminderOn: null, reminderMinutesBeforeStart: null, organizer: null, attendees: null, isOnlineMeeting: null, onlineMeetingProvider: null, onlineMeetingUrl: null, externalLink: null, isSeriesMaster: false, isException: false, seriesMasterId: null, isCancelled: false, outlookCalendarBindingId: null, outlookEventId: null, outlookEtag: null, outlookEventType: null },
  { id: 'e2', calendarId: 'cal-1', uid: 'e2@pim', title: '方案评审', description: 'P1 里程碑', location: null, dtStart: at(11), dtEnd: at(12), rrule: null, status: 'CONFIRMED', source: 'manual', originalEventId: null, isAllDay: false, timeZoneId: null, sourceTimeZoneId: null, sourceUid: null, recurrenceId: null, descriptionFormat: 'text', showAs: null, importance: null, sensitivity: null, categories: null, isReminderOn: null, reminderMinutesBeforeStart: null, organizer: null, attendees: null, isOnlineMeeting: null, onlineMeetingProvider: null, onlineMeetingUrl: null, externalLink: null, isSeriesMaster: false, isException: false, seriesMasterId: null, isCancelled: false, outlookCalendarBindingId: null, outlookEventId: null, outlookEtag: null, outlookEventType: null },
  { id: 'e3', calendarId: 'cal-2', uid: 'e3@pim', title: '健身', description: null, location: null, dtStart: at(19), dtEnd: at(20), rrule: 'FREQ=DAILY', status: 'CONFIRMED', source: 'manual', originalEventId: null, isAllDay: false, timeZoneId: null, sourceTimeZoneId: null, sourceUid: null, recurrenceId: null, descriptionFormat: 'text', showAs: null, importance: null, sensitivity: null, categories: null, isReminderOn: null, reminderMinutesBeforeStart: null, organizer: null, attendees: null, isOnlineMeeting: null, onlineMeetingProvider: null, onlineMeetingUrl: null, externalLink: null, isSeriesMaster: false, isException: false, seriesMasterId: null, isCancelled: false, outlookCalendarBindingId: null, outlookEventId: null, outlookEtag: null, outlookEventType: null },
]

const TASKS = [
  { id: 't1', calendarId: null, uid: 't1@pim', title: '写 P1 周报', description: null, priority: 9, estimatedDuration: '00:30:00', minimumSegment: null, dtStart: null, due: at(18), status: 'NEEDS-ACTION', isInbox: true, sortOrder: 1, subTasks: [], plannedEnd: null, taskBookId: 'tb-1', percentComplete: 0 },
  { id: 't2', calendarId: null, uid: 't2@pim', title: '回复客户邮件', description: null, priority: 5, estimatedDuration: '00:15:00', minimumSegment: null, dtStart: null, due: plusDays(1), status: 'NEEDS-ACTION', isInbox: true, sortOrder: 2, subTasks: [], plannedEnd: null, taskBookId: 'tb-1', percentComplete: 0 },
  { id: 't3', calendarId: null, uid: 't3@pim', title: '深度工作块：日历组件', description: null, priority: 5, estimatedDuration: '02:00:00', minimumSegment: null, dtStart: at(14), due: null, status: 'NEEDS-ACTION', isInbox: false, sortOrder: 3, subTasks: [], plannedEnd: at(16), taskBookId: 'tb-2', percentComplete: 0 },
  { id: 't4', calendarId: null, uid: 't4@pim', title: '整理收藏夹', description: null, priority: 1, estimatedDuration: null, minimumSegment: null, dtStart: null, due: null, status: 'COMPLETED', isInbox: false, sortOrder: 4, subTasks: [], plannedEnd: null, taskBookId: 'tb-2', percentComplete: 100 },
]

const LAYERS = {
  start: at(0),
  end: plusDays(1),
  items: [
    { id: 'task-segment:t3', layer: 'task-segments', objectType: 'task-segment', objectId: 'seg-1', title: '深度工作块：日历组件', startsAt: at(14), endsAt: at(16), source: 'manual', status: 'planned', color: '#22C55E', requiresConfirmation: false },
    { id: 'habit:e3', layer: 'habits', objectType: 'habit-occurrence', objectId: 'h1', title: '健身', startsAt: at(19), endsAt: at(20), source: 'manual', status: 'Planned', color: '#A855F7', requiresConfirmation: false },
    { id: 'availability:a1', layer: 'availability', objectType: 'availability-window', objectId: 'a1', title: '空闲', startsAt: at(13), endsAt: at(14), source: 'manual', status: 'available', color: '#0EA5E9', requiresConfirmation: false },
  ],
}

const CONFIRMATION = {
  id: 'c1'.padEnd(36, '0'),
  requestedByUserId: null,
  operationType: 'calendar.ai_placeholder.confirm',
  summary: '将「深度工作块：任务编辑弹窗」排入明天 09:00–11:00',
  riskLevel: 12,
  source: 'workbench',
  payloadJson: '{"horizonDays":7}',
  previewJson: '{"slots":1}',
  status: 0,
  expiresAt: plusDays(0.5),
  createdAt: at(8),
  confirmedAt: null,
  executedAt: null,
  resultJson: null,
  correlationId: null,
  changedFields: ['plannedStart', 'plannedEnd'],
  allowedActions: ['confirm', 'reject'],
  objectType: 'ai-planning-placeholder',
  objectId: 'ap-1',
  requiresSecondLevelConfirmation: false,
  beforeJson: '{"plannedStart":null}',
  afterJson: `{"plannedStart":"${plusDays(1)}"}`,
  requiresStrictConfirmation: false,
  auditBatchId: null,
  aiRecommendation: '根据最近 7 天的专注时段，上午 9-11 点是你的高效区间。',
  externalEffect: null,
  recoveryPath: '可在数据中心将任务恢复到变更前版本。',
}

const todaySection = (id, kind, status, data) => ({ id, kind, status, generatedAt: new Date().toISOString(), data, links: [{ rel: 'self', href: `/api/v1/today/sections/${id}` }], error: null })

/* ── server ─────────────────────────────────────────────── */

let seq = 100

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname

  if (path === '/api/version') {
    json(res, 200, { version: '0.9.9-mock', capabilities: ['androidEmbedV1'], latestVersion: null, checkedAt: new Date().toISOString(), error: null })
    return
  }

  const readBody = (cb) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => cb(body ? JSON.parse(body) : {}))
  }

  if (path === '/api/v1/auth/login' || path === '/api/v1/auth/register') { readBody(() => ok(res, TOKENS())); return }
  if (path === '/api/v1/auth/refresh') { ok(res, TOKENS()); return }
  if (path === '/api/v1/auth/me') { ok(res, USER); return }
  if (path === '/api/v1/status/summary') { ok(res, { status: 1, label: '正常', message: '全部组件健康（mock）', checkedAt: new Date().toISOString() }); return }

  /* 日历域 */
  if (path === '/api/v1/calendar/calendars') { ok(res, CAL_BOOKS); return }
  if (path === '/api/v1/calendar/task-books') { ok(res, TASK_BOOKS); return }
  if (path === '/api/v1/calendar/events') { paged(res, EVENTS); return }
  if (path === '/api/v1/calendar/layers') { ok(res, LAYERS); return }
  if (path === '/api/v1/calendar/tasks') {
    if (url.searchParams.has('page') || url.searchParams.has('search') || url.searchParams.has('status') || url.searchParams.has('priority') || url.searchParams.has('inbox')) {
      let list = TASKS
      if (url.searchParams.get('inbox') === 'true') list = list.filter((t) => t.isInbox)
      if (url.searchParams.get('status') === 'COMPLETED') list = list.filter((t) => t.status === 'COMPLETED')
      if (url.searchParams.get('priority')) list = list.filter((t) => t.priority === Number(url.searchParams.get('priority')))
      paged(res, list)
    } else {
      ok(res, TASKS)
    }
    return
  }
  if (path === '/api/v1/calendar/schedule') {
    readBody((body) => {
      const slots = (body.taskIds ?? []).map((id, i) => ({
        taskId: id,
        title: TASKS.find((t) => t.id === id)?.title ?? `任务${i}`,
        start: at(14 + i * 2),
        end: at(15 + i * 2),
      }))
      ok(res, { algorithmName: 'greedy', slots, metrics: { tasks_scheduled: slots.length } })
    })
    return
  }
  if (path.startsWith('/api/v1/calendar/tasks/') && path.endsWith('/segments')) {
    const taskId = path.split('/')[5]
    ok(res, [{ id: 'seg-1', taskId, taskTitle: '深度工作块：日历组件', startsAt: at(14), endsAt: at(16), status: 'planned', source: 'manual', planningReason: null, confirmationId: null }])
    return
  }
  if (path === '/api/v1/calendar/calendars/cal-1/delete-preview' || /delete-preview$/.test(path)) {
    ok(res, { targetType: 'calendar-book', targetId: 'cal-1', title: '工作', operationKind: 'calendar.delete', affectedCount: 4, samples: EVENTS.slice(0, 5).map((e) => ({ id: e.id, type: 'event', title: e.title, start: e.dtStart, end: e.dtEnd, bookName: '工作' })), summary: '删除「工作」及其 4 个活跃日程。', requiresStrictConfirmation: true })
    return
  }
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // 通用写操作回显成功
    seq++
    if (req.method === 'POST' && path === '/api/v1/calendar/events') { readBody((b) => ok(res, { ...EVENTS[0], id: `e${seq}`, ...b })); return }
    if (req.method === 'POST' && path === '/api/v1/calendar/tasks') { readBody((b) => ok(res, { ...TASKS[0], id: `t${seq}`, ...b })); return }
    if (req.method === 'DELETE') { ok(res, '已删除'); return }
    readBody((b) => ok(res, b))
    return
  }

  /* 确认中心 */
  if (path === '/api/v1/operations/confirmations/pending') { ok(res, [CONFIRMATION]); return }
  if (/^\/api\/v1\/operations\/confirmations\/[^/]+$/.test(path) && req.method === 'GET') {
    ok(res, { ...CONFIRMATION, status: url.pathname === path ? 0 : 1 })
    return
  }
  if (/^\/api\/v1\/operations\/confirmations\/[^/]+\/(confirm|confirm-second-level|confirm-strict|reject)$/.test(path)) {
    ok(res, { ...CONFIRMATION, status: path.endsWith('reject') ? 2 : 1 })
    return
  }

  /* 今日分区 */
  if (path === '/api/v1/today/sections') {
    ok(res, {
      date: url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10),
      pcBusinessDate: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      sections: [
        { id: 'calendar.schedule', kind: 'calendar.schedule', status: 'normal', links: [] },
        { id: 'calendar.tasks', kind: 'calendar.tasks', status: 'normal', links: [] },
        { id: 'pc.activity', kind: 'pc.activity', status: 'normal', links: [] },
        { id: 'pc.quality', kind: 'pc.quality', status: 'warning', links: [] },
        { id: 'operations.confirmations', kind: 'operations.confirmations', status: 'warning', links: [] },
        { id: 'operations.outlook-sync', kind: 'operations.outlook-sync', status: 'empty', links: [] },
        { id: 'operations.reminders', kind: 'operations.reminders', status: 'normal', links: [] },
        { id: 'operations.endpoints', kind: 'operations.endpoints', status: 'normal', links: [] },
      ],
    })
    return
  }
  if (path.startsWith('/api/v1/today/sections/')) {
    const id = decodeURIComponent(path.split('/')[5] ?? '')
    const byId = {
      'calendar.schedule': [ { id: 'e1', objectId: 'e1', title: '晨会', startsAt: at(9), endsAt: at(9, 30) }, { id: 'e2', objectId: 'e2', title: '方案评审', startsAt: at(11), endsAt: at(12) } ],
      'calendar.tasks': [ { id: 't3', objectId: 't3', title: '深度工作块：日历组件', startsAt: at(14), endsAt: at(16) }, { id: 't1', objectId: 't1', title: '写 P1 周报', startsAt: null, endsAt: null } ],
      'pc.activity': { items: [ { id: 'k1', title: '按键总数', value: '12,480' }, { id: 'k2', title: '活跃时长', value: '4.2 小时' } ] },
      'pc.quality': { items: [ { id: 'q1', title: '2 条记录缺少分类', message: '建议在标注队列中处理' } ] },
      'operations.confirmations': { items: [ { id: 'c1', title: '1 条待确认：排程建议', message: '来自工作台' } ] },
      'operations.outlook-sync': { items: [] },
      'operations.reminders': { items: [ { id: 'r1', title: '下午 3 点 · 提醒回复邮件', startsAt: at(15) } ] },
      'operations.endpoints': { items: [ { id: 'ep1', title: 'Windows 工作站 · 在线', message: '心跳 2 分钟前' }, { id: 'ep2', title: 'Pixel 手机 · 在线', message: '心跳 5 分钟前' } ] },
    }
    ok(res, todaySection(id, id, 'normal', byId[id] ?? { items: [] }))
    return
  }

  json(res, 404, { code: 404, message: `接口不存在: ${path}`, data: null, timestamp: new Date().toISOString() })
}).listen(5858, () => console.log('mock api on :5858'))
