import { useMemo } from 'react'
import { format } from 'date-fns'
import { parseISO } from 'date-fns'

/*
 * 分类甘特时间条（规格"甘特式时间条"）：0–24h 横向条，按分类着色。
 * PC 时间线 / 浏览器时段分布共用。
 */

export interface GanttSegment {
  start: string
  end: string
  label: string
  color: string
  tooltip?: string
}

export function DayGanttBars({ segments, height = 26 }: { segments: GanttSegment[]; height?: number }) {
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

  return (
    <div className="relative select-none rounded-ctl border border-border bg-surface" style={{ height }}>
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
          title={s.tooltip ?? `${format(parseISO(s.start), 'HH:mm')} ${s.label}`}
          className="absolute top-[3px] h-[calc(100%-6px)] overflow-hidden rounded-[4px]"
          style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%`, backgroundColor: s.color, opacity: 0.85 }}
        >
          {s.widthPct > 8 && (
            <span className="block truncate px-1.5 text-[10px] leading-[20px] text-white">{s.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}
