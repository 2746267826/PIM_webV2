import { useMemo, useState } from 'react'
import { EChartsBox } from '@/components/viz/echarts-box'
import { DayGanttBars } from '@/components/viz/day-gantt-bars'
import { KeyboardMatrix } from '@/components/viz/keyboard-matrix'
import { MouseHeatmap } from '@/components/viz/mouse-heatmap'
import {
  useActivityAnalysis,
  useAppUsage,
  useCategoryDictionary,
  useCategoryDistribution,
  useHeatmapGrid,
  useLabelMutation,
  useLabelingQueue,
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

/** PC 记录（02 §pc-tracker：分析驾驶舱主页面） */
export function PcTrackerPage() {
  const date = todayBusinessDay()
  const [dimension, setDimension] = useState<Dimension>('day')

  const { data: summary, isLoading } = usePcSummary(date)
  const { data: activity } = useActivityAnalysis(date)
  const { data: appUsage } = useAppUsage(date)
  const { data: categories } = useCategoryDistribution(date)
  const { data: productivity } = useProductivity(date)
  const { data: suggestions = [] } = useContextSuggestions(date)

  /* 维度热力：day=近 7 天、month=近 12 周、year=近 5 年 */
  const heatRange = useMemo(() => {
    const days = dimension === 'day' ? 7 : dimension === 'month' ? 84 : 1825
    return { start: businessDayShift(date, -days + 1), end: date }
  }, [dimension, date])
  const { data: heatGrid } = useHeatmapGrid(heatRange.start, heatRange.end, dimension)

  /* 甘特时间线段 */
  const ganttSegments = useMemo(
    () =>
      (summary?.timeline ?? []).map((t) => ({
        start: t.start,
        end: t.end,
        label: t.appName,
        color: t.categoryColor || '#3B82F6',
        tooltip: `${formatRange(t.start, t.end)} · ${t.categoryName} · ${t.windowTitle ?? ''}`,
      })),
    [summary],
  )

  /* 环形：分类占比 */
  const pieOption = useMemo(() => {
    const items = categories?.items ?? []
    return {
      tooltip: {},
      series: [{
        type: 'pie',
        radius: ['55%', '80%'],
        label: { show: false },
        data: items.map((c) => ({ name: c.categoryName, value: Math.round(c.minutes), itemStyle: { color: c.color } })),
      }],
    }
  }, [categories])

  /* 条形：应用时长 Top */
  const barOption = useMemo(() => {
    const items = (appUsage?.items ?? []).slice().reverse()
    return {
      grid: { left: 90, right: 20, top: 6, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94A3B8' } },
      yAxis: {
        type: 'category',
        data: items.map((i) => i.displayName ?? i.appName),
        axisLabel: { fontSize: 11, color: '#64748B' },
      },
      series: [{ type: 'bar', barWidth: 12, itemStyle: { color: '#3B82F6', borderRadius: [0, 3, 3, 0] }, data: items.map((i) => Math.round(i.totalMinutes)) }],
    }
  }, [appUsage])

  /* 生产力周趋势堆叠柱 */
  const trendOption = useMemo(() => {
    const trend = productivity?.weeklyTrend ?? []
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: '#64748B' } },
      grid: { left: 36, right: 8, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: trend.map((d) => d.date.slice(5)), axisLabel: { fontSize: 10, color: '#94A3B8' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94A3B8' } },
      series: [
        { name: '生产力', type: 'bar', stack: 'm', barWidth: 16, itemStyle: { color: '#16A34A' }, data: trend.map((d) => d.productiveMinutes) },
        { name: '中性', type: 'bar', stack: 'm', itemStyle: { color: '#94A3B8' }, data: trend.map((d) => d.neutralMinutes) },
        { name: '分心', type: 'bar', stack: 'm', itemStyle: { color: '#F97316' }, data: trend.map((d) => d.distractingMinutes) },
      ],
    }
  }, [productivity])

  /* 维度热力（ECharts heatmap） */
  const heatOption = useMemo(() => {
    const grid = heatGrid?.grid ?? []
    const data: [number, number, number][] = []
    grid.forEach((row, y) =>
      row.forEach((bucket, x) => {
        data.push([x, y, Math.round(bucket.intensityScore)])
      }),
    )
    const yLabels = dimension === 'day' ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] : grid.map((_, i) => `W${i + 1}`)
    const xLabels = dimension === 'hour'
      ? Array.from({ length: 24 }, (_, i) => `${i}时`)
      : grid[0]?.map((_, i) => String(i + 1)) ?? []
    return {
      tooltip: {},
      grid: { left: 54, right: 10, top: 4, bottom: 22 },
      xAxis: { type: 'category', data: xLabels, axisLabel: { fontSize: 9, color: '#94A3B8' } },
      yAxis: { type: 'category', data: yLabels, axisLabel: { fontSize: 9, color: '#94A3B8' } },
      visualMap: { min: 0, max: Math.max(1, heatGrid?.maxKeyCount ?? 1), show: false, inRange: { color: ['#F1F5F9', '#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8'] } },
      series: [{ type: 'heatmap', data, label: { show: false }, itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 1 } }],
    }
  }, [heatGrid, dimension])

  const m = summary?.metrics
  const ks = summary?.keystats

  return (
    <div className="space-y-5">
      <PageHeader
        title="电脑记录"
        subtitle={`业务日 ${date}（04:00 起算）`}
        actions={
          <Segmented
            size="sm"
            value={dimension}
            onValueChange={(v) => setDimension(v)}
            options={(['hour', 'day', 'month', 'year'] as Dimension[]).map((d) => ({ value: d, label: { hour: '时', day: '日', month: '月', year: '年' }[d] }))}
          />
        }
      />

      {/* 今日复盘摘要瓦片 */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryTile label="记录时长" value={m?.totalRecordedDuration ?? '—'} />
          <SummaryTile label="有效输入" value={m?.activeInputDuration ?? '—'} />
          <SummaryTile label="按键总数" value={(ks?.keyPresses ?? 0).toLocaleString()} />
          <SummaryTile label="点击总数" value={(ks?.totalClicks ?? 0).toLocaleString()} />
          <SummaryTile label="待处理建议" value={String(suggestions.filter((s) => s.status === 'pending').length)} warn={suggestions.some((s) => s.status === 'pending')} />
        </div>
      )}

      {/* 分类时间线（甘特） */}
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* 时间块热力 */}
        <Card className="p-4">
          <CardTitle>时间块热力（60 分钟）</CardTitle>
          <div className="mt-3 space-y-1.5">
            {(activity?.blocks ?? []).map((b) => (
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
            {(activity?.blocks?.length ?? 0) === 0 && <p className="py-4 text-center text-[13px] text-text-4">暂无数据</p>}
          </div>
        </Card>

        {/* 维度热力矩阵 */}
        <Card className="p-4">
          <CardTitle>维度活动热力（{dimension === 'hour' ? '24 小时' : dimension === 'day' ? '近 7 天' : dimension === 'month' ? '近 12 周' : '按年'}）</CardTitle>
          <div className="mt-3">
            <EChartsBox option={heatOption} height={200} />
          </div>
        </Card>
      </div>

      {/* 每日活动：环形 + 条形 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <CardTitle>分类时长分布</CardTitle>
          <div className="mt-2">
            {(categories?.items?.length ?? 0) === 0 ? (
              <EmptyState size="sm" title="暂无分类数据" />
            ) : (
              <EChartsBox option={pieOption} height={220} />
            )}
          </div>
        </Card>
        <Card className="p-4">
          <CardTitle>应用时长排行</CardTitle>
          <div className="mt-2">
            {(appUsage?.items?.length ?? 0) === 0 ? (
              <EmptyState size="sm" title="暂无应用数据" />
            ) : (
              <EChartsBox option={barOption} height={220} />
            )}
          </div>
        </Card>
      </div>

      {/* 生产力仪表盘 + 周趋势 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center p-4">
          <CardTitle className="self-start">生产力仪表盘</CardTitle>
          <EChartsBox
            option={{
              series: [{
                type: 'gauge',
                min: 0, max: 100,
                progress: { show: true, width: 14, itemStyle: { color: productivity?.goalMet ? '#16A34A' : '#2563EB' } },
                axisLine: { lineStyle: { width: 14, color: [[1, '#F1F5F9']] } },
                axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
                detail: { fontSize: 30, color: '#0F172A', formatter: '{value}' },
                data: [{ value: productivity?.todayScore ?? 0 }],
              }],
            }}
            height={170}
          />
          <div className="tnum text-xs text-text-3">
            生产力 {productivity?.productiveHours ?? 0}h · 分心 {productivity?.distractingHours ?? 0}h
          </div>
        </Card>
        <Card className="p-4">
          <CardTitle>近 7 天生产力趋势</CardTitle>
          <div className="mt-2">
            <EChartsBox option={trendOption} height={210} />
          </div>
        </Card>
      </div>

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
            middle={0}
            right={ks?.rightClicks ?? 0}
            sideBack={0}
            sideForward={0}
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
