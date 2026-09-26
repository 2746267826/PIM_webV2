import { useMemo } from 'react'
import { STORAGE_KEYS, setJSON } from '@/lib/storage'
import { notifySuccess } from '@/lib/notify'
import { useCalendars, useEvents, useLayers } from '../queries'
import { dayEndIso, dayStartIso } from '@/lib/datetime'
import { MiniDayCalendar } from './mini-day-calendar'
import type { CalendarVariant, MiniEvent } from './mini-day-calendar'
import { Button, Card, CardTitle, PageHeader, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/utils'

/*
 * 日历样式提案 · 第二轮（自绘高保真）：
 * 三种成熟日历产品的视觉语言，预览即所得；选定后正式日历按该语言深度定制
 * （FullCalendar 的 chrome/事件渲染完全可自定义到接近自绘效果，交互零回归）。
 */

const LAYER_COLORS: Record<string, string> = {
  'task-segments': '#22C55E',
  habits: '#A855F7',
  availability: '#0EA5E9',
  'ai-placeholders': '#F97316',
}

const PROPOSALS: {
  variant: CalendarVariant
  title: string
  ref: string
  desc: string
  traits: string[]
}[] = [
  {
    variant: 'amber',
    title: '琥珀 · 柔和卡片',
    ref: '参考 Amie / cron 的气质',
    desc: '事件是同色系渐变的圆角卡片，配同色柔和投影；小时线为虚线，整体轻盈有温度。日历本色彩被放大为界面主角。',
    traits: ['渐变卡片 + 同色投影', '虚线小时线 + 现在时刻红色胶囊', '今天胶囊徽标', '适合把日历当主工作台的用法'],
  },
  {
    variant: 'ink',
    title: '墨线 · 极简色条',
    ref: '参考 Notion Calendar 的气质',
    desc: '事件一律白底 + 左侧 3px 色条 + 发丝边框，色彩只出现在色条上；网格极淡，信息密度优先，长时间使用最不打扰。',
    traits: ['白底 + 左色条，色彩克制', '发丝级网格，密度最高', '无投影无渐变，最"工具感"', '与浅色效率主题最统一'],
  },
  {
    variant: 'glass',
    title: '玻璃 · 饱和渐变',
    ref: '参考 Fantastical 的气质',
    desc: '事件为饱和实色渐变块（白字 + 顶部高光），图层色一目了然；今天列整体着色。色彩冲击力最强，像原生日历应用。',
    traits: ['饱和渐变块 + 白字', '顶部内高光的"果冻感"', '色彩区分度最高', '演示/截图效果最好'],
  },
]

export function CalendarStylesPage() {
  const range = { start: dayStartIso(new Date()), end: dayEndIso(new Date()) }
  const { data: eventsData } = useEvents(range.start, range.end, true)
  const { data: layersData } = useLayers(range.start, range.end, 'task-segments,habits,availability,ai-placeholders', false, true)
  const { data: calendars = [] } = useCalendars('calendar')

  const miniEvents = useMemo<MiniEvent[]>(() => {
    const list: MiniEvent[] = []
    for (const ev of eventsData?.items ?? []) {
      list.push({
        id: `e:${ev.id}`,
        title: ev.title,
        start: ev.dtStart,
        end: ev.dtEnd,
        color: calendars.find((c) => c.id === ev.calendarId)?.color ?? '#3B82F6',
      })
    }
    for (const item of layersData?.items ?? []) {
      list.push({
        id: `l:${item.id}`,
        title: item.title,
        start: item.startsAt,
        end: item.endsAt,
        color: LAYER_COLORS[item.layer] ?? item.color,
        muted: item.layer === 'availability',
      })
    }
    return list
  }, [eventsData, layersData, calendars])

  function choose(variant: CalendarVariant, title: string) {
    setJSON(STORAGE_KEYS.calendarSkin, variant)
    notifySuccess(`已记录选择：${title}`, '正式日历将按该视觉语言深度定制')
  }

  return (
    <div>
      <PageHeader
        title="日历样式提案"
        subtitle="视觉语言对比（自绘高保真预览）；正式日历已采用「玻璃」方案（FullCalendar 定制，逻辑全部来自库）"
      />

      <div className="space-y-5">
        {PROPOSALS.map((p, index) => (
          <Card key={p.variant} className="overflow-hidden">
            <div className={cn('grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]', index % 2 === 1 && 'lg:grid-cols-[360px_minmax(0,1fr)]')}>
              {/* 文案区 */}
              <div className="p-5 lg:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <StatusBadge tone="info" dot={false}>{p.ref}</StatusBadge>
                  {p.variant === 'glass' && <StatusBadge tone="ok">已选用</StatusBadge>}
                </div>
                <p className="mt-2 max-w-[52ch] text-[13px] leading-5 text-text-2">{p.desc}</p>
                <ul className="mt-3 space-y-1.5">
                  {p.traits.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-[13px] text-text-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
                <Button variant="primary" size="sm" className="mt-4" onClick={() => choose(p.variant, p.title)}>
                  选用此方案
                </Button>
              </div>

              {/* 预览区 */}
              <div className={cn('border-t border-divider bg-surface p-4 lg:border-t-0', index % 2 === 1 ? 'lg:order-first lg:border-r' : 'lg:border-l')}>
                <MiniDayCalendar variant={p.variant} events={miniEvents} />
              </div>
            </div>
          </Card>
        ))}

        <Card className="p-4">
          <CardTitle className="text-[13px]">说明</CardTitle>
          <p className="mt-1.5 text-[13px] text-text-3">
            三套均为自绘渲染（重叠自动分列、现在时刻线、按事件高度自适应排版）。选定后：正式日历的
            FullCalendar 将按所选语言重写 chrome 与事件渲染（事件块/头部/网格线全部可定制，交互与现在完全一致）；
            月视图的日程 chips 同步采用同一视觉语言。也可以描述你想要的第三种感觉，我继续出新提案。
          </p>
        </Card>
      </div>
    </div>
  )
}
