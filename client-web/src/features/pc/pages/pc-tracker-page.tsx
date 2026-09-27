import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { EChartsBox, asTooltipItem, chartTooltip, isTooltipList } from '@/components/viz/echarts-box'
import { DayGanttBars } from '@/components/viz/day-gantt-bars'
import { KeyboardMatrix } from '@/components/viz/keyboard-matrix'
import { MouseHeatmap } from '@/components/viz/mouse-heatmap'
import { GitHubHeatmap, HeatMatrix, HEAT_RAMP_BLUE } from '@/components/viz/github-heatmap'
import {
  useActivityAnalysis,
  useAppUsage,
  useCategoryDictionary,
  useCategoryDistribution,
  useFocusBlocks,
  useHeatmapGrid,
  useLabelMutation,
  useLabelingQueue,
  useLateNight,
  usePcSummary,
  useProductivity,
  useSuggestionActions,
  useContextSuggestions,
} from '../queries'
import { todayBusinessDay, businessDayShift } from '@/lib/businessDay'
import { formatRange } from '@/lib/datetime'
import { Button, Card, CardTitle, Chip, EmptyState, Input, PageHeader, Segmented, Skeleton, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'

type Dimension = 'hour' | 'day' | 'month' | 'year'
type Mode = 'day' | 'range'

/** 维度 → 默认时间跨度（天）与网格形态说明 */
const DIMENSION_DAYS: Record<Dimension, number> = { hour: 1, day: 7, month: 84, year: 365 }
const DIMENSION_LABEL: Record<Dimension, string> = { hour: '当日 24 小时', day: '近 7 天', month: '近 12 周', year: '近 1 年' }

/** PC 记录（02 §pc-tracker：分析驾驶舱主页面） */
export function PcTrackerPage() {
  /* 时间范围：单日可选任意业务日；范围模式作用于支持 start/end 的聚合接口 */
  const [mode, setMode] = useState<Mode>('day')
  const [date, setDate] = useState(() => todayBusinessDay())
  const [range, setRange] = useState(() => ({
    start: businessDayShift(todayBusinessDay(), -6),
    end: todayBusinessDay(),
  }))
  const [dimension, setDimension] = useState<Dimension>('day')
  /* 强制刷新：穿透服务端聚合缓存（force=true，规格 04 §7） */
  const [force, setForce] = useState(false)

  const scope = mode === 'day' ? { date } : { start: range.start, end: range.end }
  const summary = usePcSummary(date, force, mode === 'day')
  const activity = useActivityAnalysis(date, mode === 'day', force)
  const appUsage = useAppUsage(scope)
  const categories = useCategoryDistribution(scope)
  const productivity = useProductivity(date, mode === 'day', force)
  const focusBlocks = useFocusBlocks(scope)
  const lateNight = useLateNight(scope)
  const { data: suggestions = [] } = useContextSuggestions(date)

  /*
   * 维度热力的时间窗：单日模式跟随所选日期；范围模式跟随所选范围。
   * 维度同时决定跨度（时=当日、日=近 7 天、月=近 12 周、年=近 1 年）。
   */
  const heatRange = useMemo(() => {
    if (mode === 'range') return { start: range.start, end: range.end }
    const days = DIMENSION_DAYS[dimension]
    return { start: businessDayShift(date, -days + 1), end: date }
  }, [mode, range, dimension, date])
  const heatGrid = useHeatmapGrid(heatRange.start, heatRange.end, dimension, true, force)

  /* 甘特时间线段（仅单日有分钟级时间线） */
  const ganttSegments = useMemo(
    () =>
      (summary.data?.timeline ?? []).map((t) => ({
        start: t.start,
        end: t.end,
        label: t.appName,
        color: t.categoryColor || '#3B82F6',
        tooltip: `${formatRange(t.start, t.end)} · ${t.categoryName} · ${t.windowTitle ?? ''}`,
      })),
    [summary.data],
  )

  /* 环形：分类占比 */
  const pieOption = useMemo(() => {
    const items = categories.data?.items ?? []
    return {
      tooltip: chartTooltip({
        trigger: 'item',
        formatter: (p) => {
          const it = asTooltipItem(p)
          return `${it.name}<br/>${Math.round(Number(it.value))} 分钟 · ${it.percent ?? 0}%`
        },
      }),
      series: [{
        type: 'pie',
        radius: ['55%', '80%'],
        label: { show: false },
        data: items.map((c) => ({ name: c.categoryName, value: Math.round(c.minutes), itemStyle: { color: c.color } })),
      }],
    }
  }, [categories.data])

  /* 条形：应用时长 Top */
  const barOption = useMemo(() => {
    const items = (appUsage.data?.items ?? []).slice().reverse()
    return {
      tooltip: chartTooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p) => {
          const first = asTooltipItem(p)
          return `${first.name}<br/>${Math.round(Number(first.value))} 分钟`
        },
      }),
      grid: { left: 96, right: 24, top: 6, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94A3B8' } },
      yAxis: {
        type: 'category',
        data: items.map((i) => i.displayName ?? i.appName),
        axisLabel: { fontSize: 11, color: '#64748B' },
      },
      series: [{ type: 'bar', barWidth: 12, itemStyle: { color: '#3B82F6', borderRadius: [0, 3, 3, 0] }, data: items.map((i) => Math.round(i.totalMinutes)) }],
    }
  }, [appUsage.data])

  /* 生产力周趋势堆叠柱 */
  const trendOption = useMemo(() => {
    const trend = productivity.data?.weeklyTrend ?? []
    return {
      tooltip: chartTooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p) => {
          const arr = isTooltipList(p) ? p : [p]
          const head = arr[0]?.axisValueLabel ?? ''
          const rows = arr.map((x) => `${x.marker ?? ''}${x.seriesName}：${Math.round(Number(x.value))} 分钟`).join('<br/>')
          const total = arr.reduce((a, x) => a + Number(x.value ?? 0), 0)
          return `${head}<br/>${rows}<br/><span style="opacity:.7">合计 ${Math.round(total)} 分钟</span>`
        },
      }),
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: '#64748B' } },
      grid: { left: 40, right: 12, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: trend.map((d) => d.date.slice(5)), axisLabel: { fontSize: 10, color: '#94A3B8' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94A3B8' }, name: '分钟', nameTextStyle: { fontSize: 9, color: '#94A3B8' } },
      series: [
        { name: '生产力', type: 'bar', stack: 'm', barWidth: 16, itemStyle: { color: '#16A34A' }, data: trend.map((d) => d.productiveMinutes) },
        { name: '中性', type: 'bar', stack: 'm', itemStyle: { color: '#94A3B8' }, data: trend.map((d) => d.neutralMinutes) },
        { name: '分心', type: 'bar', stack: 'm', itemStyle: { color: '#F97316' }, data: trend.map((d) => d.distractingMinutes) },
      ],
    }
  }, [productivity.data])

  /*
   * 维度热力：后端 grid 恒为「行 × 星期(7)」形态——
   * hour=1×24（当日 24 桶）、day=1×7、month=12×7、year=261×7（按天）。
   * 故 day 及以上用 GitHub 贡献图（周列 × 星期行），hour 用单行矩阵。
   */
  const heatCells = useMemo(() => {
    const grid = heatGrid.data?.grid ?? []
    const out: { date: string; value: number; detail?: string }[] = []
    for (const row of grid) {
      for (const b of row ?? []) {
        const day = b.start.slice(0, 10)
        out.push({
          date: day,
          value: Math.round(b.intensityScore),
          detail: `${b.intensityScore > 0 ? '活动强度' : '无活动'}`,
        })
      }
    }
    // year/month 维度按天返回，可能含重复日期（同一周多列）；按日期合并取和
    const merged = new Map<string, { date: string; value: number }>()
    for (const c of out) {
      const prev = merged.get(c.date)
      if (prev) prev.value += c.value
      else merged.set(c.date, { date: c.date, value: c.value })
    }
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [heatGrid.data])

  const hourMatrix = useMemo(() => {
    const grid = heatGrid.data?.grid ?? []
    return grid[0] ?? []
  }, [heatGrid.data])

  const m = summary.data?.metrics
  const ks = summary.data?.keystats

  return (
    <div className="space-y-5">
      <PageHeader
        title="电脑记录"
        subtitle={
          mode === 'day'
            ? `业务日 ${date}（04:00 起算）`
            : `范围 ${range.start} ~ ${range.end}（聚合接口按范围统计）`
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={force}
              onClick={() => {
                setForce(true)
                setTimeout(() => setForce(false), 1200)
              }}
              title="穿透服务端聚合缓存重新计算"
            >
              <RefreshCw className="size-4" aria-hidden /> 强制刷新
            </Button>
            <Segmented
              size="sm"
              value={dimension}
              onValueChange={(v) => setDimension(v)}
              options={(['hour', 'day', 'month', 'year'] as Dimension[]).map((d) => ({ value: d, label: { hour: '时', day: '日', month: '月', year: '年' }[d] }))}
            />
          </>
        }
      />

      {/* 时间范围控制：单日可任意选日；范围模式可自定义起止 */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Segmented
          size="sm"
          value={mode}
          onValueChange={(v) => setMode(v)}
          options={[
            { value: 'day', label: '单日' },
            { value: 'range', label: '范围' },
          ]}
        />
        {mode === 'day' ? (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" aria-label="前一天" onClick={() => setDate(businessDayShift(date, -1))}>←</Button>
            <Input
              type="date"
              aria-label="业务日"
              className="h-7 w-[136px] text-[13px]"
              value={date}
              max={todayBusinessDay()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <Button variant="ghost" size="sm" aria-label="后一天" disabled={date >= todayBusinessDay()} onClick={() => setDate(businessDayShift(date, 1))}>→</Button>
            {date !== todayBusinessDay() && (
              <Chip onClick={() => setDate(todayBusinessDay())}>回到今天</Chip>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {([['近 7 天', -6], ['近 30 天', -29], ['近 90 天', -89]] as const).map(([label, offset]) => {
              const active = range.start === businessDayShift(todayBusinessDay(), offset) && range.end === todayBusinessDay()
              return (
                <Chip
                  key={label}
                  active={active}
                  onClick={() => setRange({ start: businessDayShift(todayBusinessDay(), offset), end: todayBusinessDay() })}
                >
                  {label}
                </Chip>
              )
            })}
            <Input
              type="date"
              aria-label="范围起始"
              className="h-7 w-[136px] text-[13px]"
              value={range.start}
              max={range.end}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, start: e.target.value }))}
            />
            <span className="text-text-3">→</span>
            <Input
              type="date"
              aria-label="范围结束"
              className="h-7 w-[136px] text-[13px]"
              value={range.end}
              min={range.start}
              max={todayBusinessDay()}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
        )}
        <span className="ml-auto text-[11px] text-text-4">
          {mode === 'day' ? '单日模式：全部卡片可用' : '范围模式：摘要/时间线/生产力仪表盘仅支持单日，已隐藏'}
        </span>
      </Card>

      {/* 今日复盘摘要瓦片（仅单日：summary 接口只接受 date） */}
      {mode === 'day' && (summary.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryTile label="记录时长" value={m?.totalRecordedDuration ?? '—'} />
          <SummaryTile label="有效输入" value={m?.activeInputDuration ?? '—'} />
          <SummaryTile label="按键总数" value={(ks?.keyPresses ?? 0).toLocaleString()} />
          <SummaryTile label="点击总数" value={(ks?.totalClicks ?? 0).toLocaleString()} />
          <SummaryTile label="待处理建议" value={String(suggestions.filter((s) => s.status === 'pending').length)} warn={suggestions.some((s) => s.status === 'pending')} />
        </div>
      ))}

      {/* 专注块 + 深夜使用 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <CardTitle>专注块{mode === 'range' ? '（范围内）' : ''}</CardTitle>
          <div className="mt-2 space-y-1.5">
            {(focusBlocks.data?.items?.length ?? 0) === 0 ? (
              <p className="py-3 text-center text-[13px] text-text-4">{mode === 'day' ? '当日暂无连续专注时段' : '范围内暂无连续专注时段'}</p>
            ) : (
              focusBlocks.data!.items.slice(0, 6).map((b) => (
                <div key={b.startUtc} className="flex items-center gap-3 text-[13px]">
                  <span className="tnum shrink-0 text-text-3">{b.startLocal}–{b.endLocal}</span>
                  <span className="min-w-0 flex-1 truncate text-text-1">{b.mainApp}</span>
                  <span className="tnum shrink-0 text-text-3">{b.durationMinutes} 分钟</span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="p-4">
          <CardTitle>深夜使用{mode === 'range' ? '（范围内）' : ''}</CardTitle>
          <div className="mt-2 space-y-1.5">
            {(lateNight.data?.items?.length ?? 0) === 0 ? (
              <p className="py-3 text-center text-[13px] text-text-4">暂无数据</p>
            ) : (
              lateNight.data!.items.slice(0, 6).map((d) => (
                <div key={d.date} className="flex items-center gap-3 text-[13px]">
                  <span className="tnum shrink-0 text-text-3">{d.date.slice(5)}</span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-warn" style={{ width: `${Math.min(100, d.minutes)}%` }} />
                  </div>
                  <span className={cn('tnum shrink-0', d.minutes > 0 ? 'text-warn' : 'text-text-4')}>{d.minutes} 分钟</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 分类时间线（甘特，仅单日有分钟级 timeline） */}
      {mode === 'day' && (
        <Card className="p-4">
          <CardTitle>分类时间线</CardTitle>
          <div className="mt-3">
            {ganttSegments.length === 0 ? (
              <EmptyState size="sm" title="当日暂无活动时间线" />
            ) : (
              <DayGanttBars segments={ganttSegments} height={30} />
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* 时间块热力（单日 60 分钟分块） */}
        {mode === 'day' && (
          <Card className="p-4">
            <CardTitle>时间块热力（60 分钟）</CardTitle>
            <div className="mt-3 space-y-1.5">
              {(activity.data?.blocks ?? []).map((b) => (
                <div key={b.start} className="flex items-center gap-2" title={`活跃 ${Math.round(b.activeDurationSeconds / 60)} 分钟 · 切换 ${b.contextSwitchCount} 次`}>
                  <span className="tnum w-10 shrink-0 text-[11px] text-text-4">{b.start.slice(11, 16)}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, b.intensityScore)}%`, backgroundColor: b.intensityScore > 66 ? '#1D4ED8' : b.intensityScore > 33 ? '#3B82F6' : '#93C5FD' }}
                    />
                  </div>
                  {b.pendingClassificationCount > 0 && (
                    <StatusBadge tone="warn" dot={false} className="shrink-0">{b.pendingClassificationCount} 待分类</StatusBadge>
                  )}
                </div>
              ))}
              {(activity.data?.blocks?.length ?? 0) === 0 && <p className="py-4 text-center text-[13px] text-text-4">暂无数据</p>}
            </div>
          </Card>
        )}

        {/* 维度活动热力（GitHub 贡献图风格） */}
        <Card className={cn('p-4', mode === 'day' ? '' : 'xl:col-span-2')}>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>活动热力</CardTitle>
            <span className="text-xs text-text-4">
              {mode === 'range' ? `${range.start} ~ ${range.end}` : DIMENSION_LABEL[dimension]}
            </span>
          </div>
          <div className="mt-3">
            {dimension === 'hour' && mode === 'day' ? (
              hourMatrix.length === 0 ? (
                <EmptyState size="sm" title="暂无数据" />
              ) : (
                <HeatMatrix
                  values={[hourMatrix.map((b) => Math.round(b.intensityScore))]}
                  rowLabels={['强度']}
                  colLabels={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))}
                  cellSize={16}
                  gap={4}
                  unit=""
                  formatCell={(_, ci, v) => `${ci}:00–${ci + 1}:00 · 强度 ${v}`}
                  className="[&>div]:w-full [&_.flex]:justify-between"
                />
              )
            ) : heatCells.length === 0 ? (
              <EmptyState size="sm" title="暂无数据" />
            ) : (
              <GitHubHeatmap
                days={heatCells}
                ramp={HEAT_RAMP_BLUE}
                formatValue={(v) => `强度 ${v}`}
                maxWeeks={dimension === 'year' ? 53 : 26}
              />
            )}
          </div>
        </Card>
      </div>

      {/* 每日活动：环形 + 条形 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <CardTitle>分类时长分布</CardTitle>
          <div className="mt-2">
            {(categories.data?.items?.length ?? 0) === 0 ? (
              <EmptyState size="sm" title="暂无分类数据" />
            ) : (
              <EChartsBox option={pieOption} height={220} />
            )}
          </div>
        </Card>
        <Card className="p-4">
          <CardTitle>应用时长排行</CardTitle>
          <div className="mt-2">
            {(appUsage.data?.items?.length ?? 0) === 0 ? (
              <EmptyState size="sm" title="暂无应用数据" />
            ) : (
              <EChartsBox option={barOption} height={220} />
            )}
          </div>
        </Card>
      </div>

      {/* 生产力仪表盘 + 周趋势（仅单日：productivity 接口只接受 date） */}
      {mode === 'day' && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center p-4">
          <CardTitle className="self-start">生产力仪表盘</CardTitle>
          <EChartsBox
            option={{
              tooltip: chartTooltip({
                formatter: () => {
                  const p = productivity.data
                  return `今日生产力评分 <b>${p?.todayScore ?? 0}</b><br/>生产力 ${p?.productiveHours ?? 0}h · 中性 ${p?.neutralHours ?? 0}h · 分心 ${p?.distractingHours ?? 0}h${p?.goalMet ? '<br/>已达成目标' : ''}`
                },
              }),
              series: [{
                type: 'gauge',
                min: 0, max: 100,
                progress: { show: true, width: 14, itemStyle: { color: productivity.data?.goalMet ? '#16A34A' : '#2563EB' } },
                axisLine: { lineStyle: { width: 14, color: [[1, '#F1F5F9']] } },
                axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
                detail: { fontSize: 30, color: '#0F172A', formatter: '{value}' },
                data: [{ value: productivity.data?.todayScore ?? 0 }],
              }],
            }}
            height={170}
          />
          <div className="tnum text-xs text-text-3">
            生产力 {productivity.data?.productiveHours ?? 0}h · 分心 {productivity.data?.distractingHours ?? 0}h
          </div>
        </Card>
        <Card className="p-4">
          <CardTitle>近 7 天生产力趋势</CardTitle>
          <div className="mt-2">
            <EChartsBox option={trendOption} height={210} />
          </div>
        </Card>
      </div>
      )}

      {/* 键盘 + 鼠标热力 */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CardTitle>键盘热力图</CardTitle>
          <span className="tnum ml-auto text-xs text-text-4">峰值 KPS {ks?.peakKps ?? 0} · CPS {ks?.peakCps ?? 0}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <KeyboardMatrix keyCounts={ks?.keyPressCounts ?? {}} />
          <MouseHeatmap
            left={ks?.leftClicks ?? 0}
            middle={ks?.middleClicks ?? 0}
            right={ks?.rightClicks ?? 0}
            sideBack={ks?.sideBackClicks ?? 0}
            sideForward={ks?.sideForwardClicks ?? 0}
            scrollDistance={ks?.scrollDistance}
          />
        </div>
      </Card>

      {/* 标注队列 + 上下文建议 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LabelingQueue limit={5} />
        <ContextConfirmationPanel suggestions={suggestions.filter((s) => s.status === 'pending')} />
      </div>
    </div>
  )
}

function SummaryTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-card border p-4', warn ? 'border-warn-border bg-warn-soft' : 'border-border bg-bg shadow-card')}>
      <div className="text-xs text-text-3">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold text-text-1">{value}</div>
    </div>
  )
}

/** 标注队列（可展开卡：建议分类快捷钮 + 自定义分类） */
export function LabelingQueue({ limit }: { limit: number }) {
  const { data, isLoading } = useLabelingQueue(limit)
  const { data: dictionary = [] } = useCategoryDictionary()
  const label = useLabelMutation()
  const [custom, setCustom] = useState<Record<string, string>>({})

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <CardTitle>标注队列</CardTitle>
        <StatusBadge tone={data?.items?.length ? 'warn' : 'ok'} className="ml-auto">{data?.items?.length ?? 0}</StatusBadge>
      </div>
      <div className="mt-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState size="sm" title="没有待标注的应用/域名" />
        ) : (
          data!.items.map((item) => (
            <div key={item.target} className="rounded-ctl border border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-1">
                  {item.displayName}
                  <span className="ml-1.5 text-[11px] text-text-4">{item.targetType === 'app' ? '应用' : item.targetType === 'domain' ? '域名' : '手机应用'} · {item.minutes} 分钟</span>
                </span>
              </div>
              {item.sampleTitles.length > 0 && (
                <p className="mt-0.5 truncate text-[11px] text-text-4">{item.sampleTitles[0]}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {dictionary.slice(0, 4).map((d) => (
                  <Chip
                    key={d.id}
                    onClick={() => {
                      label.mutate(
                        { targetType: item.targetType, target: item.target, categoryId: d.id, scope: 'all' },
                        { onSuccess: () => notifySuccess(`已归入「${d.name}」`) },
                      )
                    }}
                  >
                    {d.name}
                  </Chip>
                ))}
                <Input
                  className="h-7 w-24 text-xs"
                  placeholder="自定义分类"
                  value={custom[item.target] ?? ''}
                  onChange={(e) => setCustom((prev) => ({ ...prev, [item.target]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = custom[item.target]?.trim()
                      if (!name) return
                      label.mutate(
                        { targetType: item.targetType, target: item.target, categoryName: name, scope: 'all' },
                        { onSuccess: () => notifySuccess(`已创建并归入「${name}」`), onError: (err) => notifyError(err instanceof Error ? err.message : '标注失败') },
                      )
                    }
                  }}
                />
                {label.isPending && <span className="text-[11px] text-text-4">保存中…</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

/** 上下文确认面板（先预览后应用） */
export function ContextConfirmationPanel({ suggestions }: { suggestions: { id: string; appDisplayName: string | null; sampleCount: number; suggestedCategory: string | null }[] }) {
  const actions = useSuggestionActions()
  const [previewResult, setPreviewResult] = useState<{ id: string; text: string } | null>(null)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <CardTitle>上下文确认</CardTitle>
        <StatusBadge tone={suggestions.length ? 'warn' : 'ok'} className="ml-auto">{suggestions.length}</StatusBadge>
      </div>
      <div className="mt-3 space-y-2">
        {suggestions.length === 0 ? (
          <EmptyState size="sm" title="没有待确认的分类建议" />
        ) : (
          suggestions.map((s) => (
            <div key={s.id} className="rounded-ctl border border-border px-3 py-2.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-medium text-text-1">{s.appDisplayName ?? '未知应用'}</span>
                <span className="text-[11px] text-text-4">{s.sampleCount} 条记录</span>
              </div>
              {s.suggestedCategory && (
                <p className="mt-0.5 text-xs text-text-3">建议分类：{s.suggestedCategory}</p>
              )}
              {previewResult?.id === s.id && (
                <p className="mt-1 rounded-ctl bg-surface px-2 py-1 text-[11px] text-text-3">{previewResult.text}</p>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={actions.preview.isPending}
                  onClick={async () => {
                    const res = await actions.preview.mutateAsync({ id: s.id, categoryName: s.suggestedCategory ?? undefined })
                    setPreviewResult({ id: s.id, text: `影响 ${res.preview.affectedRecordCount} 条记录 / ${Math.round(res.preview.affectedDurationSeconds / 60)} 分钟` })
                  }}
                >
                  预览影响
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={actions.apply.isPending}
                  onClick={async () => {
                    await actions.apply.mutateAsync({ id: s.id, categoryName: s.suggestedCategory ?? undefined })
                    notifySuccess('已应用分类并沉淀知识')
                  }}
                >
                  应用
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void actions.reject.mutateAsync(s.id)}>
                  拒绝
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
