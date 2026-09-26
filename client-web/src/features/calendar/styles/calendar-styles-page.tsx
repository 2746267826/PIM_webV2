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
  /** 当前正式日历采用的方案 */
  current?: boolean
}[] = [
  {
    variant: 'glass',
    title: '玻璃 · 饱和渐变',
    ref: '当前方案（对照）',
    desc: '上一轮选定的饱和色块。以下三个变体保留玻璃的圆角与层次，但把中间颜色置空、只留边缘色彩。',
    traits: ['饱和渐变块 + 白字', '色彩冲击力最强', '大色块视觉偏重'],
    current: true,
  },
  {
    variant: 'frost',
    title: '霜 · 浅底左条',
    ref: '玻璃的"褪色"版',
    desc: '中间置空为 8% 的极浅同色底，色彩只保留左缘 3px 色条；深色文字。保留一点色彩气氛，但不压任何内容。',
    traits: ['8% 浅底 + 左色条', '深色文字，可读性最好', '无投影，视觉轻', '月视图小格子里也干净'],
  },
  {
    variant: 'fade',
    title: '晕 · 左浓右淡',
    ref: '字面意义的"中间置空"',
    desc: '左缘 32% 色浓度向右渐隐到透明——颜色像从左边渗进来一样。保留玻璃的色彩感，但中间完全留白。',
    traits: ['水平渐变：左浓 → 中间渐白', '左色条 + 深字', '最有"渐变玻璃"的残影', '事件重叠时分列效果自然'],
  },
  {
    variant: 'outline',
    title: '框 · 彩色描边',
    ref: '最轻的一档',
    desc: '纯白底 + 1.5px 彩色描边，色彩只出现在边框和时间上；无底色无投影。整页最清爽，日历本多时也不花。',
    traits: ['白底 + 彩色描边', '时间文字用日历本色', '色彩存在感最低', '适合事件密集的日程'],
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
                  {p.current && <StatusBadge tone="ok">当前</StatusBadge>}
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
                {!p.current && (
                  <Button variant="primary" size="sm" className="mt-4" onClick={() => choose(p.variant, p.title)}>
                    选用此方案
                  </Button>
                )}
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
            四张卡为同一份数据的自绘渲染（重叠自动分列、现在时刻线）。三个"置空"变体选定后，
            正式日历同样只改样式层（CSS + 事件渲染函数），拖选/拖放/月视图等交互与库能力不变。
            想要更淡/更浓的梯度、或条的位置换到顶部/右侧，说一声即可继续出新。
          </p>
        </Card>
      </div>
    </div>
  )
}
