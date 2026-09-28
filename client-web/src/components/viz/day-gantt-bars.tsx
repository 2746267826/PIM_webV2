import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  /* hover 记录锚点矩形（视口坐标），供 fixed 定位的提示框使用 */
  const [hover, setHover] = useState<{ index: number; rect: DOMRect } | null>(null)

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

  /*
   * 提示框清除兜底：除段自身的 mouseleave 外，滚动或窗口失焦时也要收起，
   * 否则 fixed 定位的提示框会滞留在原处（与分类时间线同一套策略）。
   */
  useEffect(() => {
    if (!hover) return
    const clear = () => setHover(null)
    window.addEventListener('blur', clear)
    window.addEventListener('scroll', clear, { capture: true, passive: true })
    return () => {
      window.removeEventListener('blur', clear)
      window.removeEventListener('scroll', clear, { capture: true })
    }
  }, [hover])

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
            onMouseEnter={(e) => setHover({ index: i, rect: e.currentTarget.getBoundingClientRect() })}
            onMouseLeave={() => setHover(null)}
          >
            {s.widthPct > 8 && (
              <span className="block truncate px-1.5 text-[10px] leading-[20px] text-white">{s.label}</span>
            )}
          </div>
        ))}
      </div>

      {/*
        悬浮明细：position:fixed 依锚点矩形定位。
        不能用行内 absolute + whitespace-nowrap —— 这类元素宽度不受容器约束，
        靠右的段会把文档撑宽，从而同时产生横向与纵向滚动条。
        固定定位脱离文档流且不参与滚动尺寸计算；左右再按视口收敛，
        越界时向左收，保证提示框始终完整可见。
      */}
      {active && hover && (
        <GanttTooltip
          text={active.tooltip ?? `${format(parseISO(active.start), 'HH:mm')}–${format(parseISO(active.end), 'HH:mm')} · ${active.label}`}
          anchor={hover.rect}
        />
      )}
    </div>
  )
}

/**
 * 悬浮框位置计算（纯函数，便于单测）：
 * 以锚点为中心，但整体收敛在视口内——左右各留 margin，
 * 上/下按空间翻转，保证提示框始终完整可见且不撑大页面。
 */
export function placeTooltip(
  anchor: { left: number; top: number; bottom: number; width: number },
  box: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number | null; bottom: number | null } {
  const centerX = anchor.left + anchor.width / 2
  const maxLeft = Math.max(margin, viewport.width - box.width - margin)
  const left = Math.min(Math.max(centerX - box.width / 2, margin), maxLeft)

  const below = anchor.bottom + 6
  const flip = below + box.height + margin > viewport.height
  return flip
    ? { left, top: null, bottom: Math.max(margin, viewport.height - anchor.top + 6) }
    : { left, top: below, bottom: null }
}

/** 甘特条悬浮明细（视口内收敛，不撑大页面） */
function GanttTooltip({ text, anchor }: { text: string; anchor: DOMRect }) {
  // 先按内容测量实际尺寸，再据以收敛，避免长文本越界
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setBox({ width: r.width, height: r.height })
  }, [text])

  const pos = placeTooltip(
    anchor,
    { width: box.width || 200, height: box.height || 28 },
    { width: typeof window === 'undefined' ? 1280 : window.innerWidth, height: typeof window === 'undefined' ? 720 : window.innerHeight },
  )

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[min(420px,calc(100dvw-16px))] truncate rounded-ctl px-2.5 py-1.5 text-[11px] leading-4 text-white shadow-lg"
      style={{
        left: pos.left,
        top: pos.top ?? undefined,
        bottom: pos.bottom ?? undefined,
        backgroundColor: 'rgba(15,23,42,.92)',
      }}
    >
      {text}
    </div>
  )
}
