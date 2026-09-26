import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
} from 'echarts/charts'
import {
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { cn } from '@/lib/utils'

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

/** ECharts 通用主题：轴线/文字/网格线按设计系统着色（DESIGN.md §图表规范） */
export function themedOption(option: EChartsCoreOption): EChartsCoreOption {
  return {
    textStyle: { fontFamily: 'Inter Variable, Noto Sans SC Variable, sans-serif', color: '#64748B' },
    ...option,
  }
}

export interface EChartsBoxProps {
  option: EChartsCoreOption
  height?: number
  className?: string
  onClickData?: (params: { seriesName?: string; name?: string; value?: unknown }) => void
}

/** ECharts 按需封装：自动 init/resize/dispose */
export function EChartsBox({ option, height = 260, className, onClickData }: EChartsBoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption(themedOption(option), true)
    if (onClickData) {
      chart.off('click')
      chart.on('click', onClickData as never)
    }
  }, [option, onClickData])

  return <div ref={ref} className={cn('w-full', className)} style={{ height }} />
}

/** CSS 变量 → 实际色值（ECharts canvas 不解析 var()，标签/系列色需在运行时求值） */
export function cssVar(name: string, fallback = '#64748B'): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** 生命周期分类 → 实际色值（图表用；LIFE_CATEGORY_COLOR 存的是变量名） */
export function resolveCssColors(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(map)) {
    out[k] = v.startsWith('var(') ? cssVar(v.slice(4, -1)) : v
  }
  return out
}
