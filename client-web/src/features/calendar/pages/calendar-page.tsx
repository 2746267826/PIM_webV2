import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { ThirdPartyDraggable } from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import type { EventReceiveArg } from '@fullcalendar/interaction'
import { CalendarPlus, ChevronLeft, ChevronRight, Inbox, Paintbrush } from 'lucide-react'
import { Link } from 'react-router'
import '../styles/calendar-skins.css'
import { useCalendarVisibility } from '../calendar-visibility'
import { useCalendars, useEvents, useInboxTasks, useLayers, usePlanTask, useTaskBooks } from '../queries'
import { EventEditorDialog } from '../components/event-editor-dialog'
import { EventDetailDialog } from '../components/entity-detail-dialogs'
import { TaskEditorDialog } from '../components/task-editor-dialog'
import { InboxPanel } from '../components/inbox-panel'
import type { EventResponse, LayerItem } from '../types'
import { dayEndIso, dayStartIso, durationToMinutes, formatTime, toUtcIso } from '@/lib/datetime'
import { summarizeLines } from '@/lib/text'
import { Chip, Button, Drawer, DrawerContent, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'

interface FcEvent {
  id: string
  title: string
  start?: string
  end?: string
  allDay?: boolean
  backgroundColor: string
  borderColor: string
  extendedProps: { kind: 'event' | 'layer'; event?: EventResponse; cancelled?: boolean; repeated?: boolean }
}

const LAYER_COLORS: Record<string, string> = {
  'task-segments': '#22C55E',
  habits: '#A855F7',
  availability: '#0EA5E9',
  'ai-placeholders': '#F97316',
}

/** 闲忙状态 → 中文徽标文案（仅非默认值显示，避免每卡都挂「忙碌」） */
const SHOW_AS_LABEL: Record<string, string> = {
  free: '空闲',
  tentative: '暂定',
  away: '离开',
  workingElsewhere: '异地工作',
}

function showAsLabel(showAs: string | null | undefined): string | null {
  if (!showAs) return null
  return SHOW_AS_LABEL[showAs] ?? null
}

/** 日历页（02 §日历：时间轴/月视图 + 图层 chips + 拖选预填 + 收件箱拖入排期） */
export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') ?? 'timeline') === 'month' ? 'month' : 'timeline'
  const calendarId = params.get('calendarId') ?? undefined

  const { layerToggles, toggleLayer } = useCalendarVisibility()
  const { data: calendars = [] } = useCalendars('calendar')
  const { data: taskBooks = [] } = useTaskBooks()
  const { data: inboxData } = useInboxTasks()
  const plan = usePlanTask()

  const calendarRef = useRef<FullCalendar>(null)
  const [range, setRange] = useState(() => ({
    start: dayStartIso(new Date()),
    end: dayEndIso(new Date()),
    title: '',
  }))

  const eventsQuery = useEvents(range.start, range.end, layerToggles.events)
  const layersQuery = useLayers(
    range.start,
    range.end,
    'task-segments,habits,availability,ai-placeholders',
    layerToggles.outlookOnly,
    layerToggles['task-segments'] || layerToggles.habits || layerToggles.availability || layerToggles['ai-placeholders'],
  )

  const [eventEditor, setEventEditor] = useState<
    { mode: 'create'; initial: { start: Date; end: Date } } | { mode: 'edit'; event: EventResponse } | null
  >(null)
  /* 只读详情：点击卡片先看详情，再决定是否编辑 */
  const [detail, setDetail] = useState<EventResponse | null>(null)
  const [taskEditorOpen, setTaskEditorOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)

  /* 数据 → FullCalendar 事件源 */
  const fcEvents = useMemo<FcEvent[]>(() => {
    const list: FcEvent[] = []
    if (layerToggles.events) {
      for (const ev of eventsQuery.data?.items ?? []) {
        if (calendarId && ev.calendarId !== calendarId) continue
        const color = calendars.find((c) => c.id === ev.calendarId)?.color ?? '#3B82F6'
        list.push({
          id: `event:${ev.id}`,
          title: ev.title,
          start: ev.dtStart,
          end: ev.dtEnd,
          allDay: ev.isAllDay,
          backgroundColor: color,
          borderColor: 'transparent',
          extendedProps: { kind: 'event', event: ev, cancelled: ev.isCancelled, repeated: Boolean(ev.rrule) || ev.isSeriesMaster },
        })
      }
    }
    const layerItems: LayerItem[] = layersQuery.data?.items ?? []
    for (const item of layerItems) {
      if (!layerToggles[item.layer]) continue
      const color = LAYER_COLORS[item.layer] ?? item.color
      list.push({
        id: item.id,
        title: item.title,
        start: item.startsAt,
        end: item.endsAt,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { kind: 'layer' },
      })
    }
    return list
  }, [eventsQuery.data, layersQuery.data, layerToggles, calendars, calendarId])

  function setView(next: 'timeline' | 'month') {
    setParams((p) => {
      const np = new URLSearchParams(p)
      np.set('view', next)
      return np
    })
    // initialView 仅初始化生效，切换必须走 api.changeView
    calendarRef.current?.getApi().changeView(next === 'month' ? 'dayGridMonth' : 'timeGridDay')
  }

  function onDatesSet(arg: DatesSetArg) {
    // FullCalendar 的 startStr/endStr 带本地偏移（+08:00），后端 DateTime 解析会 500 → 归一到 UTC
    const start = toUtcIso(arg.startStr) ?? dayStartIso(new Date())
    const end = toUtcIso(arg.endStr) ?? dayEndIso(new Date())
    setRange({ start, end, title: arg.view.title })
  }

  function onEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.event as EventResponse | undefined
    if (event) setDetail(event)
  }

  /*
   * 月视图点击日期格 → 跳到该日时间轴（规格：月网格用于选日）。
   * 点日程本身仍走 onEventClick（详情），由 FullCalendar 自行区分事件与空白格。
   */
  function onDateClick(arg: { date: Date; dateStr: string; allDay: boolean; jsEvent: MouseEvent }) {
    if (view !== 'month') return
    // dateClick 在点中事件时也会触发（jsEvent.target 落在 .fc-event 内），此时交给 onEventClick
    const target = arg.jsEvent.target as HTMLElement | null
    if (target?.closest('.fc-event')) return
    calendarRef.current?.getApi().gotoDate(arg.date)
    setView('timeline')
  }

  /*
   * 卡片内容按可用高度逐级展示。行序号即行名：1=标题、2=pim-ev-when、3..7=描述行。
   * 两套排版：常规（py 8 + 标题 16 + 其余 12）与紧凑（py 1 + 标题 14 + 其余 11）。
   * 高度 < 48px 时用紧凑排版，可以多放一行（如 45min 能显示标题+时间+1 行描述）。
   * 实测：15min≈16px→1 行、30min≈31px→2 行、45min≈46px→3 行、1h≈60px→4 行、100min≈102px→7 行。
   * 挂载后量一次写入 data-density（应显示行数）与 data-compact（排版档位），
   * 由皮肤 CSS 同时控制行高与第 n+1 行起的隐藏；
   * 用 CSS 而非内联 style，可在视图切换/缩放后由 FC 重挂载自然重算。
   */
  function onEventDidMount(arg: { el: HTMLElement; view: { type: string } }) {
    if (arg.view.type.startsWith('dayGrid')) return
    const h = arg.el.getBoundingClientRect().height
    const compact = h < 48
    const rows = compact
      ? Math.floor((h - 15) / 11) + 1 // 1 + 14 + 11(n-1)
      : Math.floor((h - 24) / 12) + 1 // 8 + 16 + 12(n-1)
    if (compact) arg.el.dataset.compact = '1'
    arg.el.dataset.density = String(Math.max(1, Math.min(7, rows)))
  }

  /* 拖选空白时段 → 预填日程编辑弹窗（仅时间轴视图） */
  function onSelect(info: { start: Date; end: Date; allDay: boolean }) {
    setEventEditor({ mode: 'create', initial: { start: info.start, end: info.end } })
  }

  /*
   * 收件箱任务拖入 → 排期（自动按时长估算）。
   * FullCalendar v6 外部拖入由 pointer events 驱动，必须用 ThirdPartyDraggable 包装拖拽源；
   * 同时必须提供 eventData —— 否则只有 drop 回调、没有镜像吸附与落位动画。
   * 这里把拖拽中的临时事件交给 FC 渲染（得到原生拖拽动画 + 时间槽吸附），
   * 在 eventReceive 里把它移除，改由服务端数据（排期后的任务段图层）呈现真实状态。
   */
  useEffect(() => {
    if (typeof document === 'undefined') return
    const draggable = new ThirdPartyDraggable(document.body, {
      itemSelector: '.fc-external-drag',
      eventData: (el) => {
        const duration = el.getAttribute('data-task-duration') ?? '01:00:00'
        const minutes = durationToMinutes(duration) ?? 60
        return {
          title: el.getAttribute('data-task-title') ?? '任务',
          duration: { minutes },
          create: true,
        }
      },
    })
    return () => draggable.destroy()
  }, [])

  /** 镜像落位：移除临时事件（真实呈现交给排期后的服务端图层），并发起排期 */
  function onEventReceive(info: EventReceiveArg) {
    const taskId = info.draggedEl.getAttribute('data-task-id')
    // 落位时间取 FC 计算好的事件起点（已吸附到时间槽）
    const start = info.event.start ?? undefined
    // 立即移除镜像事件：日历上的真实呈现由 /calendar/layers 的 task-segments 提供
    info.event.remove()
    if (!taskId) return

    const task = (inboxData ?? []).find((t) => t.id === taskId)
    const minutes = durationToMinutes(task?.estimatedDuration ?? null) ?? 60
    const end = start ? new Date(start.getTime() + minutes * 60_000) : undefined

    plan.mutate(
      {
        id: taskId,
        body: {
          plannedStart: (start ?? new Date()).toISOString(),
          ...(end ? { plannedEnd: end.toISOString() } : {}),
          ...(task?.estimatedDuration ? { estimatedDuration: task.estimatedDuration } : {}),
        },
      },
      {
        onSuccess: () => notifySuccess(`已排期：${task?.title ?? '任务'}`),
        onError: (e) => notifyError(e instanceof Error ? e.message : '排期失败'),
      },
    )
  }

  const truncated = (eventsQuery.data?.totalCount ?? 0) > (eventsQuery.data?.items.length ?? 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="日历"
        subtitle={range.title}
        actions={
          <>
            <Link
              to="/calendar-styles"
              title="日历样式对比：选择一套视觉方案"
              className="inline-flex h-8 items-center gap-1.5 rounded-ctl px-3 text-[13px] font-medium text-text-2 transition-colors hover:bg-surface hover:text-text-1 outline-none"
            >
              <Paintbrush className="size-4" aria-hidden /> 皮肤
            </Link>
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setInboxOpen(true)}>
              <Inbox className="size-4" aria-hidden /> 收件箱
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setTaskEditorOpen(true)}>
              新建任务
            </Button>
            <Button variant="primary" size="sm" onClick={() => setEventEditor({ mode: 'create', initial: { start: new Date(), end: new Date(Date.now() + 3600_000) } })}>
              <CalendarPlus className="size-4" aria-hidden /> 新建日程
            </Button>
          </>
        }
      />

      {/* 工具条：日期导航 + 视图切换 + 图层 chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="前一天" onClick={() => calendarRef.current?.getApi().prev()}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => calendarRef.current?.getApi().today()}>
            今天
          </Button>
          <Button variant="ghost" size="sm" aria-label="后一天" onClick={() => calendarRef.current?.getApi().next()}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <CalendarSegmented view={view} onChange={setView} />
        <div className="flex flex-wrap items-center gap-1.5 lg:ml-2">
          <Chip active={layerToggles.events} onClick={() => toggleLayer('events')}>日程</Chip>
          <Chip active={layerToggles['task-segments']} onClick={() => toggleLayer('task-segments')}>任务段</Chip>
          <Chip active={layerToggles.habits} onClick={() => toggleLayer('habits')}>习惯</Chip>
          <Chip active={layerToggles.availability} onClick={() => toggleLayer('availability')}>可用时间</Chip>
          <Chip active={layerToggles['ai-placeholders']} onClick={() => toggleLayer('ai-placeholders')}>智能占位</Chip>
          <Chip active={layerToggles.outlookOnly} onClick={() => toggleLayer('outlookOnly')}>仅 Outlook</Chip>
        </div>
      </div>

      {truncated && (
        <div className="mb-2 rounded-ctl border border-warn-border bg-warn-soft px-3 py-1.5 text-xs text-warn">
          当前窗口事件超过 100 条，仅显示前 100 条（可缩小时间范围查看更多）。
        </div>
      )}

      {/* 日历主体 + 收件箱侧板（皮肤：谷歌竖条日视图 / 圆点行月视图） */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* 日历网格自身滚动：收件箱侧板因此常驻可见（主滚动容器在外壳 main 上） */}
        <div className="skin-gcal min-w-0 flex-1 overflow-y-auto select-none [&_.fc-event-mirror]:pointer-events-none">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={zhCnLocale}
            headerToolbar={false}
            initialView={view === 'month' ? 'dayGridMonth' : 'timeGridDay'}
            datesSet={onDatesSet}
            events={fcEvents}
            selectable={view === 'timeline'}
            selectMirror
            select={onSelect}
            dateClick={onDateClick}
            droppable
            eventReceive={onEventReceive}
            eventClick={onEventClick}
            eventDidMount={onEventDidMount}
            height="auto"
            stickyHeaderDates
            allDaySlot
            nowIndicator
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            firstDay={1}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventContent={(arg) => {
              const ev = arg.event.extendedProps.event as EventResponse | undefined
              const cancelled = arg.event.extendedProps.cancelled as boolean | undefined
              const repeated = arg.event.extendedProps.repeated as boolean | undefined
              // 月视图：GCal 圆点行（彩点 + 时间 + 标题）
              if (arg.view.type.startsWith('dayGrid')) {
                return (
                  <div className="flex min-w-0 items-center gap-1.5 px-0.5 py-0.5">
                    {!cancelled && (
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: arg.event.backgroundColor }}
                        aria-hidden
                      />
                    )}
                    {arg.timeText && (
                      <span className="tnum shrink-0 text-[11px] text-text-3">{arg.timeText}</span>
                    )}
                    <span
                      className={cn(
                        'truncate text-[12px] leading-4 font-medium',
                        cancelled ? 'text-text-4 line-through' : 'text-text-1',
                      )}
                    >
                      {repeated && <span className="mr-0.5 text-text-3">↻</span>}
                      {arg.event.title}
                    </span>
                  </div>
                )
              }
              // 日视图：谷歌竖条（白底左宽条由皮肤 CSS 绘制，这里只排文字）
              // 顶部对齐；行数由 data-density（eventDidMount 实测高度写入）经 CSS 逐级放开
              const lines = summarizeLines(ev?.description, { exclude: [ev?.location, ev?.title], maxLines: 5 })
              const metaLine = [ev?.location, showAsLabel(ev?.showAs)].filter(Boolean).join(' · ')
              const whenText = arg.timeText || (ev ? formatTime(ev.dtStart) : '')
              return (
                <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[inherit] py-1 pr-1.5 pl-1">
                  {cancelled ? (
                    <span className="truncate text-[11px] leading-4 font-medium text-text-4 line-through">
                      {arg.event.title}
                    </span>
                  ) : (
                    <>
                      <span className="truncate text-[11px] leading-4 font-semibold">
                        {repeated && <span className="mr-0.5 font-normal text-text-3">↻</span>}
                        {arg.event.title}
                      </span>
                      {/* 次行：时间始终显示（极矮卡片也不丢时间） */}
                      {whenText && (
                        <span className="pim-ev-when tnum truncate text-[10px] leading-3 text-text-3">
                          {whenText}
                          {metaLine && <span className="font-sans"> · {metaLine}</span>}
                        </span>
                      )}
                      {/* 第三行起：描述逐行展示，行数越多放开越多 */}
                      {lines[0] && (
                        <span className="pim-ev-row3 truncate text-[10px] leading-3 text-text-4">{lines[0]}</span>
                      )}
                      {lines[1] && (
                        <span className="pim-ev-row4 truncate text-[10px] leading-3 text-text-4">{lines[1]}</span>
                      )}
                      {lines[2] && (
                        <span className="pim-ev-row5 truncate text-[10px] leading-3 text-text-4">{lines[2]}</span>
                      )}
                      {lines[3] && (
                        <span className="pim-ev-row6 truncate text-[10px] leading-3 text-text-4">{lines[3]}</span>
                      )}
                      {lines[4] && (
                        <span className="pim-ev-row7 truncate text-[10px] leading-3 text-text-4">{lines[4]}</span>
                      )}
                    </>
                  )}
                </div>
              )
            }}
          />
        </div>

        {/* 收件箱侧板（≥1024 常驻；日历网格独立滚动，此板不动，拖拽源不跑出视口） */}
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div className="h-full max-h-[calc(100dvh-8rem)] overflow-hidden rounded-card border border-border bg-bg shadow-card">
            <InboxPanel
            onNewTask={() => setTaskEditorOpen(true)}
            onNewEvent={() =>
              setEventEditor({ mode: 'create', initial: { start: nextHour(), end: nextHourPlus() } })
            }
          />
          </div>
        </aside>
      </div>

      {/* 窄屏收件箱抽屉 */}
      <Drawer open={inboxOpen} onOpenChange={setInboxOpen}>
        <DrawerContent side="right" className="w-[320px]">
            <InboxPanel
            onNewTask={() => {
              setInboxOpen(false)
              setTaskEditorOpen(true)
            }}
            onNewEvent={() => {
              setInboxOpen(false)
              setEventEditor({ mode: 'create', initial: { start: nextHour(), end: nextHourPlus() } })
            }}
          />
        </DrawerContent>
      </Drawer>

      <EventEditorDialog
        open={eventEditor != null}
        onOpenChange={(o) => !o && setEventEditor(null)}
        calendars={calendars}
        initial={eventEditor?.mode === 'create' ? eventEditor.initial : null}
        event={eventEditor?.mode === 'edit' ? eventEditor.event : null}
      />
      <TaskEditorDialog open={taskEditorOpen} onOpenChange={setTaskEditorOpen} taskBooks={taskBooks} />

      {/* 详情（只读）→ 点「编辑」才进编辑弹窗 */}
      <EventDetailDialog
        event={detail}
        calendarName={calendars.find((c) => c.id === detail?.calendarId)?.name}
        onClose={() => setDetail(null)}
        onEdit={(ev) => {
          setDetail(null)
          setEventEditor({ mode: 'edit', event: ev })
        }}
      />
    </div>
  )
}

function nextHour(): Date {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return d
}
function nextHourPlus(): Date {
  const d = nextHour()
  d.setHours(d.getHours() + 1)
  return d
}

function CalendarSegmented({ view, onChange }: { view: 'timeline' | 'month'; onChange: (v: 'timeline' | 'month') => void }) {
  return (
    <div className="inline-flex items-center rounded-full bg-surface-2 p-[3px]">
      {(
        [
          { v: 'timeline', label: '时间轴' },
          { v: 'month', label: '月' },
        ] as const
      ).map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'h-7 rounded-full px-3 text-[13px] font-medium text-text-3 transition-colors',
            view === o.v && 'bg-bg text-primary shadow-card',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
