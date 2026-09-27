import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

/*
 * 分类甘特时间条（规格"甘特式时间条"）：0–24h 横向条，按分类着色。
 * PC 时间线 / 浏览器时段分布共用。
 * 悬浮显示自定义 tooltip（原生 title 延迟长、样式不可控，且无法展示多行明细）。
 */

export interface GanttSegment {
  start: string
  end: string
  label: string
  color: string
  tooltip?: string
}

export function DayGanttBars({ segments, height = 26 }: { segments: GanttSegment[]; height?: number }) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null)

  const placed = useMemo(() => {
    return segments
      .map((s) => {
        const st = parseISO(s.start)
        const en = parseISO(s.end)
        const leftPct = ((st.getHours() * 60 + st.getMinutes()) / 1440) * 100
        const widthPct = Math.max(0.4, ((en.getTime() - st.getTime()) / 3600_000 / 24) * 100)
        return { ...s, leftPct, widthPct }
      })
      .filter((s) => s.widthPct > 0)
  }, [segments])

  const hours = useMemo(() => Array.from({ length: 25 }, (_, i) => i), [])
  const active = hover ? placed[hover.index] : null

  return (
    <div className="relative">
      <div
        className="relative select-none rounded-ctl border border-border bg-surface"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {hours.map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-divider"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {h % 6 === 0 && (
              <span className="tnum absolute top-0.5 left-0.5 text-[9px] text-text-4">{String(h).padStart(2, '0')}</span>
            )}
          </div>
        ))}
        {placed.map((s, i) => (
          <div
            key={i}
            className={cn(
              'absolute top-[3px] h-[calc(100%-6px)] overflow-hidden rounded-[4px] transition-opacity',
              hover && hover.index !== i ? 'opacity-40' : 'opacity-85',
            )}
            style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%`, backgroundColor: s.color }}
            onMouseEnter={(e) => {
              const host = e.currentTarget.parentElement?.getBoundingClientRect()
              const own = e.currentTarget.getBoundingClientRect()
              setHover({ index: i, x: own.left - (host?.left ?? 0) + own.width / 2, y: own.top - (host?.top ?? 0) })
            }}
          >
            {s.widthPct > 8 && (
              <span className="block truncate px-1.5 text-[10px] leading-[20px] text-white">{s.label}</span>
            )}
          </div>
        ))}

        {/* 悬浮明细 */}
        {active && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-ctl px-2.5 py-1.5 text-[11px] leading-4 whitespace-nowrap text-white shadow-lg"
            style={{
              left: Math.min(Math.max(hover!.x, 60), 10000),
              top: '100%',
              marginTop: 6,
              backgroundColor: 'rgba(15,23,42,.92)',
            }}
          >
            {active.tooltip ?? `${format(parseISO(active.start), 'HH:mm')}–${format(parseISO(active.end), 'HH:mm')} · ${active.label}`}
          </div>
        )}
      </div>
    </div>
  )
}
