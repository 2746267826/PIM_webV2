import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/*
 * GitHub 贡献图风格热力图（全局统一）：
 * - 小圆角方块（默认 11px）+ 4px 间距，5 档色阶，空值为最浅底
 * - 顶部月份标签、左侧星期标签、右下「少 → 多」图例
 * - 纯 CSS grid + DOM，悬浮用原生 title（不依赖 canvas，可访问性好）
 *
 * 两种数据形态：按天序列（GitHub 原版）与「周 × 星期」矩阵（PC 网格接口返回）。
 */

export interface HeatDay {
  /** yyyy-MM-dd（本地口径） */
  date: string
  value: number
  /** 悬浮补充说明（如分类明细） */
  detail?: string
}

/** 色阶：GitHub 风格绿色；可传入自定义 5 档 */
export const HEAT_RAMP_BLUE = ['#EBEDF0', '#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8']
export const HEAT_RAMP_GREEN = ['#EBEDF0', '#9BE9A8', '#40C463', '#30A14E', '#216E39']
export const HEAT_RAMP_ORANGE = ['#EBEDF0', '#FED7AA', '#FDBA74', '#F97316', '#C2410C']

/** 值 → 档位（0 为第 0 档；其余按最大值四等分） */
export function heatLevel(value: number, max: number): number {
  if (!value || value <= 0) return 0
  if (max <= 0) return 1
  const ratio = value / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** ISO 周一为一周起点（0=周一 … 6=周日） */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface GitHubHeatmapProps {
  /** 数据点（任意顺序，内部按 date 索引） */
  days: HeatDay[]
  /** 单元尺寸（px），默认 11 */
  cellSize?: number
  /** 单元间距（px），默认 3 */
  gap?: number
  /** 色阶，默认蓝色系 */
  ramp?: string[]
  /** 单位后缀（悬浮提示用，如 "分钟"） */
  unit?: string
  /** 数值格式化（悬浮提示用） */
  formatValue?: (v: number) => string
  className?: string
  /** 显示的周数上限（超出则只保留最近 N 周），默认 53（约一年） */
  maxWeeks?: number
}

/**
 * 按天序列 → GitHub 贡献图。
 * 自动补全区间内的空缺日（空值渲染为最浅色），列=周、行=星期。
 */
export function GitHubHeatmap({
  days,
  cellSize = 11,
  gap = 3,
  ramp = HEAT_RAMP_BLUE,
  unit = '',
  formatValue,
  className,
  maxWeeks = 53,
}: GitHubHeatmapProps) {
  const model = useMemo(() => {
    const byDate = new Map<string, HeatDay>()
    for (const d of days) byDate.set(d.date, d)
    const max = days.reduce((acc, d) => Math.max(acc, d.value), 0)

    if (days.length === 0) {
      return { weeks: [] as (HeatDay | null)[][], monthMarks: [] as { col: number; label: string }[], max, total: 0 }
    }

    const sorted = days.map((d) => d.date).sort()
    const first = parseLocalDate(sorted[0])
    const last = parseLocalDate(sorted[sorted.length - 1])

    // 起点回退到所在周的周一
    const start = new Date(first)
    start.setDate(start.getDate() - mondayIndex(start))

    const cells: (HeatDay | null)[] = []
    const cursor = new Date(start)
    while (cursor <= last) {
      const key = dateKey(cursor)
      const hit = byDate.get(key)
      cells.push(hit ?? (cursor >= first ? { date: key, value: 0 } : null))
      cursor.setDate(cursor.getDate() + 1)
    }

    // 切成周列
    const weeks: (HeatDay | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    const trimmed = weeks.length > maxWeeks ? weeks.slice(-maxWeeks) : weeks

    // 月份标签：某列首日进入新月份即标注
    const monthMarks: { col: number; label: string }[] = []
    let lastMonth = -1
    trimmed.forEach((week, col) => {
      const firstDay = week.find(Boolean)
      if (!firstDay) return
      const m = parseLocalDate(firstDay.date).getMonth()
      if (m !== lastMonth) {
        // 同月标签至少间隔 3 列，避免拥挤
        const prev = monthMarks[monthMarks.length - 1]
        if (!prev || col - prev.col >= 3) monthMarks.push({ col, label: `${m + 1}月` })
        lastMonth = m
      }
    })

    return { weeks: trimmed, monthMarks, max, total: days.reduce((a, d) => a + d.value, 0) }
  }, [days, maxWeeks])

  const fmt = formatValue ?? ((v: number) => v.toLocaleString())

  if (model.weeks.length === 0) {
    return <p className={cn('py-4 text-center text-[13px] text-text-4', className)}>暂无数据</p>
  }

  const gridWidth = model.weeks.length * (cellSize + gap) - gap

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="inline-block min-w-full">
        {/* 月份标签 */}
        <div className="relative mb-1 h-3.5" style={{ width: gridWidth, marginLeft: 22 }}>
          {model.monthMarks.map((mk) => (
            <span
              key={`${mk.col}-${mk.label}`}
              className="absolute text-[10px] text-text-4"
              style={{ left: mk.col * (cellSize + gap) }}
            >
              {mk.label}
            </span>
          ))}
        </div>

        <div className="flex gap-1.5">
          {/* 星期标签（只标周一/三/五，与 GitHub 一致） */}
          <div className="flex shrink-0 flex-col" style={{ gap, paddingTop: 0 }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <span
                key={w}
                className="text-[9px] leading-none text-text-4"
                style={{ height: cellSize, width: 16, lineHeight: `${cellSize}px` }}
              >
                {i % 2 === 0 ? w : ''}
              </span>
            ))}
          </div>

          {/* 周列 */}
          <div className="flex" style={{ gap }}>
            {model.weeks.map((week, col) => (
              <div key={col} className="flex flex-col" style={{ gap }}>
                {Array.from({ length: 7 }, (_, row) => {
                  const cell = week[row]
                  if (!cell) {
                    return <div key={row} style={{ width: cellSize, height: cellSize }} aria-hidden />
                  }
                  const level = heatLevel(cell.value, model.max)
                  const d = parseLocalDate(cell.date)
                  const title =
                    cell.value > 0
                      ? `${cell.date} 周${WEEKDAY_LABELS[mondayIndex(d)]}：${fmt(cell.value)}${unit}${cell.detail ? ` · ${cell.detail}` : ''}`
                      : `${cell.date}：无记录`
                  return (
                    <div
                      key={row}
                      title={title}
                      className="rounded-[2px] transition-[transform,box-shadow] duration-100 hover:scale-125 hover:shadow-sm"
                      style={{ width: cellSize, height: cellSize, backgroundColor: ramp[level] }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 图例 */}
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-text-4">
          <span>少</span>
          {ramp.map((c) => (
            <span key={c} className="rounded-[2px]" style={{ width: cellSize, height: cellSize, backgroundColor: c }} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  )
}

export interface HeatMatrixProps {
  /** 矩阵：rows × cols，每格为数值 */
  values: number[][]
  rowLabels: string[]
  colLabels: string[]
  cellSize?: number
  gap?: number
  ramp?: string[]
  unit?: string
  /** 悬浮提示：行/列/值 → 文本 */
  formatCell?: (row: number, col: number, value: number) => string
  className?: string
}

/**
 * 「行 × 列」矩阵热力（PC 网格接口的 day/month/year 维度返回的就是这种形态）。
 * 同样采用 GitHub 的方块 + 5 档色阶视觉，避免 ECharts heatmap 的默认观感。
 */
export function HeatMatrix({
  values,
  rowLabels,
  colLabels,
  cellSize = 11,
  gap = 3,
  ramp = HEAT_RAMP_BLUE,
  unit = '',
  formatCell,
  className,
}: HeatMatrixProps) {
  const max = useMemo(
    () => values.reduce((acc, row) => Math.max(acc, ...row, 0), 0),
    [values],
  )
  if (values.length === 0) {
    return <p className={cn('py-4 text-center text-[13px] text-text-4', className)}>暂无数据</p>
  }
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="inline-block">
        {/* 列标签 */}
        <div className="mb-1 flex" style={{ gap, marginLeft: 30 }}>
          {colLabels.map((c) => (
            <span key={c} className="text-center text-[9px] text-text-4" style={{ width: cellSize }}>
              {c}
            </span>
          ))}
        </div>
        {values.map((row, ri) => (
          <div key={ri} className="flex items-center" style={{ gap, marginBottom: gap }}>
            <span className="shrink-0 pr-1 text-right text-[9px] text-text-4" style={{ width: 26 }}>
              {rowLabels[ri] ?? ''}
            </span>
            {row.map((v, ci) => {
              const level = heatLevel(v, max)
              const title = formatCell
                ? formatCell(ri, ci, v)
                : `${rowLabels[ri] ?? ''} ${colLabels[ci] ?? ''}：${v.toLocaleString()}${unit}`
              return (
                <div
                  key={ci}
                  title={title}
                  className="rounded-[2px] transition-[transform,box-shadow] duration-100 hover:scale-125 hover:shadow-sm"
                  style={{ width: cellSize, height: cellSize, backgroundColor: ramp[level] }}
                />
              )
            })}
          </div>
        ))}
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-text-4">
          <span>少</span>
          {ramp.map((c) => (
            <span key={c} className="rounded-[2px]" style={{ width: cellSize, height: cellSize, backgroundColor: c }} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  )
}
