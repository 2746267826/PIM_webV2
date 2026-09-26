import { useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import { createCalendar, createViewDay } from '@schedule-x/calendar'
import { ScheduleXCalendar } from '@schedule-x/react'
import '@schedule-x/theme-default/dist/calendar.css'
import '../styles/calendar-skins.css'
import { useCalendars, useEvents, useLayers } from '../queries'
import { dayEndIso, dayStartIso } from '@/lib/datetime'
import { Card, CardSubtitle, CardTitle, ErrorBoundary, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * 日历样式对比页（/calendar-styles）：
 * 同一份今日数据，四种视觉方案并排预览；选定后按该方向打磨正式日历。
 * - A 极简无格线：FullCalendar 深度定制（保留现有全部交互）
 * - B 纸面细格：FullCalendar 定制（Google Calendar 气质）
 * - C 自研分区时间轴：完全贴设计系统（自绘）
 * - D Schedule-X：第三方现代日历库（换库方案）
 */

interface FcEvent {
  id: string
  title: string
  start?: string
  end?: string
  backgroundColor: string
  borderColor: string
  extendedProps: { leftBar?: string; dark?: boolean }
}

const LAYER_COLORS: Record<string, string> = {
  'task-segments': '#22C55E',
  habits: '#A855F7',
  availability: '#0EA5E9',
  'ai-placeholders': '#F97316',
}

function hexAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** FullCalendar 通用迷你渲染器：skin 控制外观，事件统一"浅底+左色条"视觉 */
function SkinFc({
  skin,
  events,
  className,
}: {
  skin: 'skin-minimal' | 'skin-paper'
  events: FcEvent[]
  className?: string
}) {
  return (
    <div className={cn(skin, 'fc-scale-[0.94] fc-origin-[top_left]', className)}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={zhCnLocale}
        headerToolbar={false}
        initialView="timeGridDay"
        initialDate={new Date()}
        events={events}
        height={520}
        allDaySlot={false}
        nowIndicator
        firstDay={1}
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventContent={(arg) => {
          const leftBar = arg.event.extendedProps.leftBar
          const short =
            arg.event.start && arg.event.end &&
            arg.event.end.getTime() - arg.event.start.getTime() < 45 * 60_000
          return (
            <div
              className="flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-[inherit] px-0.5 py-0.5"
              style={leftBar ? { borderLeft: `3px solid ${leftBar}` } : undefined}
            >
              {short ? (
                <span className="truncate text-[11px] leading-4 font-medium">{arg.event.title}</span>
              ) : (
                <>
                  <span className="tnum text-[10px] leading-3 opacity-80">{arg.timeText}</span>
                  <span className="truncate text-[11px] leading-4 font-medium">{arg.event.title}</span>
                </>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}

/** 皮肤 C：自研分区时间轴（完全贴设计系统的自绘方案示意） */
function SkinOwnTimeline({ events }: { events: { title: string; start: string; end: string; color: string }[] }) {
  const START_HOUR = 6
  const END_HOUR = 24
  const PX_PER_HOUR = 34
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  return (
    <div className="relative" style={{ height: (END_HOUR - START_HOUR) * PX_PER_HOUR }}>
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-divider" style={{ top: (h - START_HOUR) * PX_PER_HOUR }}>
          <span className="tnum absolute -top-2 left-0 bg-bg pr-2 text-[10px] text-text-4">{String(h).padStart(2, '0')}:00</span>
        </div>
      ))}
      {events.map((e) => {
        const start = new Date(e.start)
        const end = new Date(e.end)
        const top = ((start.getHours() + start.getMinutes() / 60) - START_HOUR) * PX_PER_HOUR
        const height = Math.max(18, ((end.getTime() - start.getTime()) / 3600_000) * PX_PER_HOUR - 2)
        if (end.getHours() < START_HOUR) return null
        return (
          <div
            key={e.title}
            className="absolute right-1 left-11 overflow-hidden rounded-ctl px-2 py-1 shadow-card"
            style={{ top, height, backgroundColor: hexAlpha(e.color, 0.12), borderLeft: `3px solid ${e.color}` }}
          >
            <div className="truncate text-[11px] leading-4 font-medium text-text-1">{e.title}</div>
            <div className="tnum text-[10px] leading-3 text-text-3">
              {String(start.getHours()).padStart(2, '0')}:{String(start.getMinutes()).padStart(2, '0')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 皮肤 D：Schedule-X（换库方案，默认主题原样展示） */
/** 皮肤 D：Schedule-X（换库方案，默认主题原样展示）；v4 事件要求 Temporal.ZonedDateTime */
function toSxTime(iso: string): unknown {
  const t = iso.slice(0, 19)
  const T = (globalThis as { Temporal?: { PlainDateTime: { from(v: string): { toZonedDateTime(tz: string): unknown } } } }).Temporal
  if (!T) return iso
  return T.PlainDateTime.from(t).toZonedDateTime('Asia/Shanghai')
}

function SkinScheduleX({ events }: { events: { id: string; title: string; start: string; end: string }[] }) {
  const calendar = useMemo(
    () =>
      createCalendar({
        locale: 'zh-CN',
        views: [createViewDay()],
        dayBoundaries: { start: '06:00', end: '24:00' },
        events: events.map((e) => ({ ...e, start: toSxTime(e.start), end: toSxTime(e.end) })) as never,
      }),
    [events],
  )
  return (
    <ErrorBoundary level="card">
      <ScheduleXCalendar calendarApp={calendar} />
    </ErrorBoundary>
  )
}

export function CalendarStylesPage() {
  const range = { start: dayStartIso(new Date()), end: dayEndIso(new Date()) }
  const { data: eventsData } = useEvents(range.start, range.end, true)
  const { data: layersData } = useLayers(range.start, range.end, 'task-segments,habits,availability,ai-placeholders', false, true)
  const { data: calendars = [] } = useCalendars('calendar')

  /* 每套皮肤各自的事件视觉参数 */
  const minimalEvents = useMemo<FcEvent[]>(() => {
    const list: FcEvent[] = []
    for (const ev of eventsData?.items ?? []) {
      const color = calendars.find((c) => c.id === ev.calendarId)?.color ?? '#3B82F6'
      list.push({ id: ev.id, title: ev.title, start: ev.dtStart, end: ev.dtEnd, backgroundColor: hexAlpha(color, 0.14), borderColor: 'transparent', extendedProps: { leftBar: color } })
    }
    for (const item of layersData?.items ?? []) {
      const color = LAYER_COLORS[item.layer] ?? item.color
      list.push({ id: item.id, title: item.title, start: item.startsAt, end: item.endsAt, backgroundColor: hexAlpha(color, 0.14), borderColor: 'transparent', extendedProps: { leftBar: color } })
    }
    return list
  }, [eventsData, layersData, calendars])

  const solidEvents = useMemo<FcEvent[]>(
    () => minimalEvents.map((e) => ({ ...e, backgroundColor: hexAlpha(e.extendedProps.leftBar ?? '#3B82F6', 0.14), borderColor: e.extendedProps.leftBar ?? '#3B82F6' })),
    [minimalEvents],
  )

  const ownEvents = useMemo(
    () => [
      ...(eventsData?.items ?? []).map((ev) => ({ title: ev.title, start: ev.dtStart, end: ev.dtEnd, color: calendars.find((c) => c.id === ev.calendarId)?.color ?? '#3B82F6' })),
      ...(layersData?.items ?? []).map((item) => ({ title: item.title, start: item.startsAt, end: item.endsAt, color: LAYER_COLORS[item.layer] ?? item.color })),
    ],
    [eventsData, layersData, calendars],
  )

  const sxEvents = useMemo(
    () => ownEvents.map((e, i) => ({
      id: String(i),
      title: e.title,
      start: e.start.slice(0, 16).replace('T', ' '),
      end: e.end.slice(0, 16).replace('T', ' '),
    })),
    [ownEvents],
  )

  return (
    <div>
      <PageHeader
        title="日历样式对比"
        subtitle="同一份今日数据、四种视觉方案；选定后按该方向深度打磨正式日历（当前正式页仍为默认样式）"
      />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card className="overflow-hidden p-4">
          <CardTitle>A · 极简无格线（推荐）</CardTitle>
          <CardSubtitle className="mt-0.5">FullCalendar 深度定制——去竖线、事件浅底+左色条、圆角 8。保留全部现有交互（拖选/拖放/月视图）。</CardSubtitle>
          <div className="mt-3">
            <SkinFc skin="skin-minimal" events={minimalEvents} />
          </div>
        </Card>

        <Card className="overflow-hidden p-4">
          <CardTitle>B · 纸面细格</CardTitle>
          <CardSubtitle className="mt-0.5">Google Calendar 气质——保留细网格、今日列淡蓝、事件浅底左条。</CardSubtitle>
          <div className="mt-3">
            <SkinFc skin="skin-paper" events={solidEvents} />
          </div>
        </Card>

        <Card className="overflow-hidden p-4">
          <CardTitle>C · 自研分区时间轴</CardTitle>
          <CardSubtitle className="mt-0.5">完全自绘、100% 贴设计系统；拖选/拖放需自研（工作量最大，视觉可控性最强）。</CardSubtitle>
          <div className="mt-3 border-t border-divider pt-2">
            <SkinOwnTimeline events={ownEvents} />
          </div>
        </Card>

        <Card className="overflow-hidden p-4">
          <CardTitle>D · Schedule-X 库</CardTitle>
          <CardSubtitle className="mt-0.5">第三方现代日历库默认主题；换库需重接拖选/拖放，月视图与交互以库能力为准。</CardSubtitle>
          <div className="mt-3">
            <SkinScheduleX events={sxEvents} />
          </div>
        </Card>
      </div>
    </div>
  )
}
