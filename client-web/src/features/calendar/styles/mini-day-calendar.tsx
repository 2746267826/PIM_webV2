import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/*
 * 高保真日视觉提案（自绘，预览即所得）：
 * 三种视觉语言 —— amber（Amie 式柔和渐变）/ ink（Notion 式极简色条）/ glass（Fantastical 式饱和渐变）。
 * 重叠事件按簇分列排布；含现在时刻指示线。
 */

export type CalendarVariant = 'amber' | 'ink' | 'glass'

export interface MiniEvent {
  id: string
  title: string
  start: string
  end: string
  color: string
  muted?: boolean
}

const START_HOUR = 6
const END_HOUR = 24
const PX_PER_HOUR = 44

interface Column {
  event: MiniEvent
  column: number
  columns: number
  top: number
  height: number
}

/** 重叠事件 → 簇内分列（简单贪心） */
function layout(events: MiniEvent[], now: Date): Column[] {
  const parsed = events
    .map((e) => ({ ...e, s: new Date(e.start), en: new Date(e.end) }))
    .filter((e) => e.en.getTime() > e.s.getTime())
    .sort((a, b) => a.s.getTime() - b.s.getTime() || b.en.getTime() - a.en.getTime())

  const clusters: { items: typeof parsed; end: number }[] = []
  for (const e of parsed) {
    const last = clusters[clusters.length - 1]
    if (last && e.s.getTime() < last.end) {
      last.items.push(e)
      last.end = Math.max(last.end, e.en.getTime())
    } else {
      clusters.push({ items: [e], end: e.en.getTime() })
    }
  }

  const out: Column[] = []
  for (const cluster of clusters) {
    const colEnds: number[] = []
    const assigned = cluster.items.map((e) => {
      // 严格大于：相同起止的事件也分列，避免完全重叠
      let col = colEnds.findIndex((t) => e.s.getTime() > t)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(0)
      }
      colEnds[col] = e.en.getTime()
      return { e, col }
    })
    for (const { e, col } of assigned) {
      const top = ((e.s.getHours() + e.s.getMinutes() / 60) - START_HOUR) * PX_PER_HOUR
      const rawH = ((e.en.getTime() - e.s.getTime()) / 3600_000) * PX_PER_HOUR
      out.push({ event: e, column: col, columns: colEnds.length, top: Math.max(0, top), height: Math.max(20, rawH - 3) })
    }
  }

  // 现在时刻线特殊处理在渲染层
  void now
  return out
}

function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const VARIANT_EVENT: Record<CalendarVariant, (e: MiniEvent, c: Column) => React.CSSProperties> = {
  // 琥珀：柔和同色系渐变块，圆角大，带同色投影
  amber: (e) => ({
    background: `linear-gradient(160deg, ${hexAlpha(e.color, 0.22)}, ${hexAlpha(e.color, 0.13)})`,
    borderLeft: `3px solid ${e.color}`,
    borderRadius: 10,
    boxShadow: `0 2px 8px ${hexAlpha(e.color, 0.18)}`,
    color: 'var(--color-text-1)',
  }),
  // 墨线：白底极简，左色条 3px，发丝边
  ink: (e) => ({
    background: 'var(--color-bg)',
    borderLeft: `3px solid ${e.color}`,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    borderLeftWidth: 3,
    color: 'var(--color-text-1)',
  }),
  // 玻璃：饱和实色渐变、白字、顶部高光
  glass: (e) => ({
    background: `linear-gradient(180deg, ${lighten(e.color, 0.18)}, ${e.color})`,
    borderRadius: 8,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.35), 0 2px 6px ${hexAlpha(e.color, 0.35)}`,
    color: '#ffffff',
  }),
}

function hexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

export function MiniDayCalendar({
  variant,
  events,
  className,
}: {
  variant: CalendarVariant
  events: MiniEvent[]
  className?: string
}) {
  const now = useMemo(() => new Date(), [])
  const columns = useMemo(() => layout(events, now), [events, now])
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    [],
  )

  const nowVisible =
    now.getHours() >= START_HOUR && now.getHours() < END_HOUR
  const nowTop = (now.getHours() + now.getMinutes() / 60 - START_HOUR) * PX_PER_HOUR

  return (
    <div
      className={cn(
        'relative select-none overflow-hidden rounded-card border border-border bg-bg',
        variant === 'ink' && 'shadow-none',
        className,
      )}
    >
      {/* 头部日期 */}
      <div
        className={cn(
          'flex items-baseline gap-2 border-b px-4 py-2.5',
          variant === 'ink' ? 'border-divider' : 'border-divider bg-surface/60',
        )}
      >
        <span
          className={cn(
            'tnum font-semibold',
            variant === 'amber' ? 'text-[22px] leading-7 text-text-1' : 'text-[18px] leading-6 text-text-1',
          )}
        >
          26
        </span>
        <span className="text-xs text-text-3">星期六</span>
        {variant === 'amber' && (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-fg">今天</span>
        )}
      </div>

      {/* 时间网格 */}
      <div className="relative" style={{ height: (END_HOUR - START_HOUR) * PX_PER_HOUR }}>
        {hours.map((h) => (
          <div
            key={h}
            className="absolute inset-x-0"
            style={{ top: (h - START_HOUR) * PX_PER_HOUR }}
          >
            <div
              className={cn(
                'border-t',
                variant === 'ink' ? 'border-divider' : 'border-divider/70 border-dashed',
              )}
            />
            <span
              className={cn(
                'tnum absolute -top-2 w-10 text-right',
                variant === 'ink' ? 'left-0 pr-2 text-[10px] text-text-4' : 'left-1 text-[10px] text-text-4',
              )}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        {/* 事件块 */}
        {columns.map(({ event: e, column, columns: cols, top, height }) => {
          const left = 52 + column * (12 / cols)
          const right = 6 + (cols - 1 - column) * (12 / cols)
          const short = height < 34
          const startD = new Date(e.start)
          return (
            <div
              key={e.id}
              className="absolute overflow-hidden px-2 py-1"
              style={{
                top,
                height,
                left,
                right,
                ...VARIANT_EVENT[variant](e, { event: e, column, columns: cols, top, height }),
              }}
            >
              <div className={cn('truncate font-medium', short ? 'text-[11px] leading-[18px]' : 'text-[12px] leading-4')}>
                {e.title}
              </div>
              {!short && (
                <div className={cn('tnum text-[10px] leading-3', variant === 'glass' ? 'text-white/80' : 'text-text-3')}>
                  {timeLabel(startD)}
                </div>
              )}
            </div>
          )
        })}

        {/* 现在时刻线 */}
        {nowVisible && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
            <div className="relative border-t-2 border-crit">
              <span className="absolute -top-[5px] -left-1 size-2.5 rounded-full border-2 border-crit bg-bg" />
              <span className="tnum absolute -top-2.5 left-11 rounded bg-crit px-1 text-[10px] leading-4 text-white">
                {timeLabel(now)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
