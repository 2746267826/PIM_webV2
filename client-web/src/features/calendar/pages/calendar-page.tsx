import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import { CalendarPlus, ChevronLeft, ChevronRight, Inbox, Paintbrush } from 'lucide-react'
import { Link } from 'react-router'
import '../styles/calendar-skins.css'
import { useCalendarVisibility } from '../calendar-visibility'
import { useCalendars, useEvents, useLayers, usePlanTask, useTaskBooks } from '../queries'
import { EventEditorDialog } from '../components/event-editor-dialog'
import { TaskEditorDialog } from '../components/task-editor-dialog'
import { InboxPanel } from '../components/inbox-panel'
import type { EventResponse, LayerItem } from '../types'
import { dayEndIso, dayStartIso } from '@/lib/datetime'
import { Chip, Button, Drawer, DrawerContent, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { notifyError } from '@/lib/notify'

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

/** 日历页（02 §日历：时间轴/月视图 + 图层 chips + 拖选预填 + 收件箱拖入排期） */
export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') ?? 'timeline') === 'month' ? 'month' : 'timeline'
  const calendarId = params.get('calendarId') ?? undefined

  const { layerToggles, toggleLayer } = useCalendarVisibility()
  const { data: calendars = [] } = useCalendars('calendar')
  const { data: taskBooks = [] } = useTaskBooks()
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
    setRange({ start: arg.startStr, end: arg.endStr, title: arg.view.title })
  }

  function onEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.event as EventResponse | undefined
    if (event) setEventEditor({ mode: 'edit', event })
  }

  /* 拖选空白时段 → 预填日程编辑弹窗（仅时间轴视图） */
  function onSelect(info: { start: Date; end: Date; allDay: boolean }) {
    setEventEditor({ mode: 'create', initial: { start: info.start, end: info.end } })
  }

  /* 收件箱任务拖入 → 排期（自动按时长估算） */
  function onDrop(info: { date: Date; draggedEl: HTMLElement }) {
    const taskId = info.draggedEl.getAttribute('data-task-id')
    if (!taskId) return
    const start = info.date
    plan.mutate(
      { id: taskId, body: { plannedStart: start.toISOString() } },
      { onError: (e) => notifyError(e instanceof Error ? e.message : '排期失败') },
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
        <div className="skin-gcal min-w-0 flex-1">
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
            droppable
            drop={onDrop}
            eventClick={onEventClick}
            height="auto"
            allDaySlot
            nowIndicator
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            firstDay={1}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventContent={(arg) => {
              const cancelled = arg.event.extendedProps.cancelled as boolean | undefined
              const repeated = arg.event.extendedProps.repeated as boolean | undefined
              const short =
                arg.event.start && arg.event.end &&
                arg.event.end.getTime() - arg.event.start.getTime() < 45 * 60_000
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
              return (
                <div className="flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-[inherit] py-0.5 pr-1.5 pl-1">
                  {cancelled ? (
                    <span className="truncate text-[11px] leading-4 font-medium text-text-4 line-through">
                      {arg.event.title}
                    </span>
                  ) : (
                    <>
                      {short ? (
                        <span className="truncate text-[11px] leading-4 font-semibold">
                          {repeated && <span className="mr-0.5 font-normal text-text-3">↻</span>}
                          {arg.event.title}
                        </span>
                      ) : (
                        <>
                          <span className="tnum text-[10px] leading-3 text-text-3">{arg.timeText}</span>
                          <span className="truncate text-[11px] leading-4 font-semibold">
                            {repeated && <span className="mr-0.5 font-normal text-text-3">↻</span>}
                            {arg.event.title}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            }}
          />
        </div>

        {/* 收件箱侧板（≥1024 常驻） */}
        <aside className="hidden w-[280px] shrink-0 border-l border-border lg:block">
          <InboxPanel
            onNewTask={() => setTaskEditorOpen(true)}
            onNewEvent={() =>
              setEventEditor({ mode: 'create', initial: { start: nextHour(), end: nextHourPlus() } })
            }
          />
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
