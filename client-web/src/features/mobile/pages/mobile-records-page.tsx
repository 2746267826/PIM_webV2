import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { RefreshCw, Smartphone } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useLiveness,
  useMobileCharts,
  useMobileHeatmap,
  useMobileOverview,
  useTimelineBlocks,
} from '../queries'
import { mobileApi } from '../api'
import { todayBusinessDay, businessDayShift, businessDayRange } from '@/lib/businessDay'
import { LIFE_CATEGORY_COLOR } from '@/lib/enums'
import { formatDuration, formatTime } from '@/lib/datetime'
import { EChartsBox } from '@/components/viz/echarts-box'
import { Button, Card, CardTitle, Chip, EmptyState, MetricCard, PageHeader, Segmented, Skeleton, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/utils'

function useRangeParams(days: number): Record<string, string> {
  return useMemo(() => {
    const end = todayBusinessDay()
    const start = businessDayShift(end, -(days - 1))
    return {
      rangeStartUtc: businessDayRange(start).startUtc,
      rangeEndUtc: businessDayRange(end).endUtc,
    }
  }, [days])
}

type View = 'usage' | 'liveness'
type RangeKey = 1 | 7 | 30

function lifeColor(cat: string | null): string {
  return LIFE_CATEGORY_COLOR[cat as keyof typeof LIFE_CATEGORY_COLOR] ?? 'var(--color-cat-other)'
}

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 1, label: '今天' },
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
]

/** 手机记录（02 §mobile-records：使用记录 / 设备存活双子视图，?view=liveness） */
export function MobileRecordsPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'liveness' ? 'liveness' : 'usage'
  const [days, setDays] = useState<RangeKey>(7)
  const range = useRangeParams(days)

  function setView(v: View) {
    setParams(v === 'liveness' ? { view: 'liveness' } : {})
  }

  return (
    <div>
      <PageHeader
        title="手机记录"
        subtitle="Android 使用分析（业务日 04:00 起算）"
        actions={<Segmented value={view} onValueChange={(v) => setView(v as View)} options={[
          { value: 'usage', label: '使用记录' },
          { value: 'liveness', label: '设备存活' },
        ]} />}
      />

      {view === 'usage' ? <UsageView days={days} setDays={setDays} range={range} /> : <LivenessView />}
    </div>
  )
}

/* ── 使用记录 ─────────────────────────────────────────────── */

function UsageView({ days, setDays, range }: { days: RangeKey; setDays: (d: RangeKey) => void; range: Record<string, string> }) {
  const qc = useQueryClient()
  const [force, setForce] = useState(false)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const overview = useMobileOverview({ ...range, force: force || undefined })
  const heatmap = useMobileHeatmap({ ...range, granularity: 'hour' })
  const charts = useMobileCharts(range)
  const blocks = useTimelineBlocks({ ...range, page, pageSize: 20 })

  const o = overview.data
  const [refreshing, setRefreshing] = useState(false)

  async function forceRefresh() {
    setRefreshing(true)
    setForce(true)
    await qc.invalidateQueries({ queryKey: ['mobile'] })
    setTimeout(() => setForce(false), 800)
    setRefreshing(false)
  }

  /* 热力图（ECharts heatmap：x=本地小时，y=本地日） */
  const heatOption = useMemo(() => {
    const buckets = heatmap.data ?? []
    const dates = [...new Set(buckets.map((b) => b.localDate))].sort()
    const data: [number, number, number][] = buckets.map((b) => [
      b.localHour,
      dates.indexOf(b.localDate),
      Math.round(b.foregroundSeconds / 60),
    ])
    return {
      tooltip: { formatter: (p: { value: [number, number, number] }) => `${dates[p.value[1]]} ${p.value[0]}时 · ${p.value[2]} 分钟` },
      grid: { left: 70, right: 10, top: 4, bottom: 22 },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}`), axisLabel: { fontSize: 9, color: '#94A3B8' } },
      yAxis: { type: 'category', data: dates.map((d) => d.slice(5)), axisLabel: { fontSize: 10, color: '#64748B' } },
      visualMap: { min: 0, max: Math.max(10, ...data.map((d) => d[2])), show: false, inRange: { color: ['#F1F5F9', '#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8'] } },
      series: [{ type: 'heatmap', data, itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 1 } }],
    }
  }, [heatmap.data])

  /* 图表网格（服务端 8 张预设，按 chartType 分发） */
  const chartCards = useMemo(() => {
    return (charts.data ?? []).map((c) => ({ c, option: chartToOption(c) }))
  }, [charts.data])

  return (
    <div className="space-y-5">
      {/* 筛选行 */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((r) => (
          <Chip key={r.value} active={days === r.value} onClick={() => { setDays(r.value); setPage(1) }}>{r.label}</Chip>
        ))}
        <Chip onClick={() => void forceRefresh()}>
          <RefreshCw className={cn('mr-1 inline size-3', refreshing && 'animate-spin')} aria-hidden /> 强制刷新
        </Chip>
      </div>

      {/* 概览指标条 */}
      {overview.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="使用总时长" value={formatDuration(o?.totalForegroundSeconds ?? 0)} icon={Smartphone} />
          <MetricCard label="日均" value={formatDuration(o?.dailyAverageSeconds ?? 0)} />
          <MetricCard label="应用数" value={o?.appCount ?? 0} />
          <MetricCard
            label="完整度"
            value={`${Math.round((o?.completeness ?? 0) * 100)}%`}
            hint={(o?.quality.fallbackShare ?? 0) > 0.3 ? 'fallback 占比偏高' : undefined}
            hintTone="warn"
          />
        </div>
      )}

      {/* 热力图 */}
      <Card className="p-4">
        <CardTitle>使用热力图（本地日 × 小时）</CardTitle>
        <div className="mt-3">
          {(heatmap.data?.length ?? 0) === 0 ? (
            <EmptyState size="sm" title="暂无使用数据" />
          ) : (
            <EChartsBox option={heatOption} height={200} />
          )}
        </div>
      </Card>

      {/* 图表网格（服务端定义） */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {chartCards.map(({ c, option }) => (
          <Card key={c.key} className="p-4">
            <CardTitle>{c.title}</CardTitle>
            <div className="mt-2">
              {c.points.length === 0 ? (
                <EmptyState size="sm" title="暂无数据" />
              ) : (
                <EChartsBox option={option} height={200} />
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* 时间线下钻（块 → 会话） */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CardTitle>时间线块</CardTitle>
          <div className="ml-auto flex items-center gap-2 text-xs text-text-3">
            <span className="tnum">共 {blocks.data?.totalCount ?? 0} 块</span>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <span className="tnum">{page}</span>
            <Button variant="secondary" size="sm" disabled={!blocks.data?.hasMore} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {(blocks.data?.items ?? []).map((b) => (
            <div key={b.id} className="rounded-ctl border border-border">
              <button
                type="button"
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left outline-none"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: lifeColor(b.lifeCategory) }} aria-hidden />
                <span className="tnum text-xs text-text-3">{b.localStart}–{b.localEnd}</span>
                <span className="truncate text-[13px] font-medium text-text-1">{b.topApps[0]?.displayName ?? b.lifeCategory}{b.appCount > 1 ? ` 等 ${b.appCount} 个应用` : ''}</span>
                <span className="tnum ml-auto shrink-0 text-xs text-text-3">{formatDuration(b.foregroundSeconds)}</span>
              </button>
              {expanded === b.id && <BlockSessions blockId={b.id} range={range} />}
            </div>
          ))}
          {(blocks.data?.items?.length ?? 0) === 0 && <EmptyState size="sm" title="暂无时间线块" />}
        </div>
      </Card>

      {/* 异常与建议 */}
      {(o?.anomalies?.length ?? 0) > 0 || (o?.suggestions?.length ?? 0) > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="p-4">
            <CardTitle>异常</CardTitle>
            <div className="mt-2 space-y-1.5">
              {(o?.anomalies ?? []).map((a) => (
                <div key={a.code} className="rounded-ctl bg-warn-soft px-3 py-2 text-[13px]">
                  <b className="text-warn">{a.title}</b>
                  <span className="ml-2 text-text-2">{a.evidence}</span>
                </div>
              ))}
              {(o?.anomalies?.length ?? 0) === 0 && <p className="text-[13px] text-text-4">无异常</p>}
            </div>
          </Card>
          <Card className="p-4">
            <CardTitle>建议</CardTitle>
            <div className="mt-2 space-y-1.5">
              {(o?.suggestions ?? []).map((s) => (
                <div key={s.code} className="rounded-ctl bg-surface px-3 py-2 text-[13px] text-text-2">{s.text}</div>
              ))}
              {(o?.suggestions?.length ?? 0) === 0 && <p className="text-[13px] text-text-4">无建议</p>}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

/** 块内会话列表（二级下钻） */
function BlockSessions({ blockId, range }: { blockId: string; range: Record<string, string> }) {
  const [loaded, setLoaded] = useState(false)
  const [sessions, setSessions] = useState<{ id: string; displayName: string; startUtc: string; endUtc: string | null; durationSeconds: number }[] | null>(null)

  if (!loaded) {
    setLoaded(true)
    void mobileApi
      .blockSessions(blockId, range)
      .then(setSessions)
      .catch(() => setSessions([]))
  }

  return (
    <div className="border-t border-divider bg-surface px-3 py-2">
      {sessions == null ? (
        <Skeleton className="h-8" />
      ) : sessions.length === 0 ? (
        <p className="py-1 text-xs text-text-4">无会话明细</p>
      ) : (
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-text-2">{s.displayName}</span>
              <span className="tnum text-text-4">{formatTime(s.startUtc)}</span>
              <span className="tnum text-text-3">{formatDuration(s.durationSeconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 服务端图表 DTO → ECharts option */
function chartToOption(c: { chartType: string; points: { label: string; value: number; lifeCategory?: string | null }[] }) {
  if (c.chartType === 'pie' || c.chartType === 'category-share') {
    return {
      tooltip: {},
      series: [{
        type: 'pie',
        radius: ['45%', '72%'],
        label: { show: false },
        data: c.points.map((p) => ({ name: p.label, value: Math.round(p.value), itemStyle: { color: lifeColor(p.lifeCategory ?? null) } })),
      }],
    }
  }
  if (c.chartType === 'daily-total' || c.chartType === 'category-trend' || c.chartType === 'switch-trend') {
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 44, right: 10, top: 10, bottom: 24 },
      xAxis: { type: 'category', data: c.points.map((p) => p.label.slice(5)), axisLabel: { fontSize: 10, color: '#94A3B8' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94A3B8' } },
      series: [{ type: 'line', smooth: true, symbolSize: 5, itemStyle: { color: '#2563EB' }, areaStyle: { color: 'rgba(37,99,235,.08)' }, data: c.points.map((p) => Math.round(p.value * 100) / 100) }],
    }
  }
  // bar 类（top-apps / hour-distribution 等）
  const items = c.points.slice(0, 10).slice().reverse()
  return {
    grid: { left: 90, right: 16, top: 6, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94A3B8' } },
    yAxis: { type: 'category', data: items.map((p) => p.label), axisLabel: { fontSize: 11, color: '#64748B' } },
    series: [{ type: 'bar', barWidth: 12, itemStyle: { color: '#3B82F6', borderRadius: [0, 3, 3, 0] }, data: items.map((p) => Math.round(p.value * 100) / 100) }],
  }
}

/* ── 设备存活 ─────────────────────────────────────────────── */

function LivenessView() {
  const [rangeDays, setRangeDays] = useState(7)
  const params = useRangeParams(rangeDays)
  const { data, isLoading } = useLiveness(params, true)

  const groups = [
    { label: '手机', items: data?.phones ?? [] },
    { label: '平板', items: data?.tablets ?? [] },
    { label: '未分类机型', items: data?.unclassified ?? [] },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {([7, 30] as const).map((d) => (
          <Chip key={d} active={rangeDays === d} onClick={() => setRangeDays(d)}>近 {d} 天</Chip>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : (
        groups.map((g) =>
          g.items.length === 0 ? null : (
            <section key={g.label}>
              <h3 className="mb-2 text-xs font-medium text-text-3">{g.label}（{g.items.length}）</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {g.items.map((d) => (
                  <DeviceLivenessCard key={d.deviceId} device={d} />
                ))}
              </div>
            </section>
          ),
        )
      )}
    </div>
  )
}

function DeviceLivenessCard({ device: d }: { device: { deviceId: string; displayName: string; deviceKindLabel: string; hasData: boolean; conclusion: string; coverageByHour: number | null; longestSilenceMinutes: number; silences: { minutes: number; severityLabel: string }[]; causes: { label: string; count: number }[] } }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <CardTitle className="truncate">{d.displayName}</CardTitle>
        <StatusBadge tone={d.hasData ? 'ok' : 'neutral'} dot={false} className="ml-auto">{d.deviceKindLabel}</StatusBadge>
      </div>
      {!d.hasData ? (
        <p className="mt-2 text-[13px] text-text-4">无数据/未上报：该区间内没有任何存活证据。</p>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-text-2">{d.conclusion}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-ctl bg-surface py-1.5">
              <div className="tnum text-sm font-semibold text-text-1">{d.coverageByHour != null ? `${Math.round(d.coverageByHour * 100)}%` : '—'}</div>
              <div className="text-[10px] text-text-4">按小时覆盖</div>
            </div>
            <div className="rounded-ctl bg-surface py-1.5">
              <div className={cn('tnum text-sm font-semibold', d.longestSilenceMinutes >= 60 ? 'text-crit' : d.longestSilenceMinutes >= 30 ? 'text-warn' : 'text-text-1')}>
                {d.longestSilenceMinutes} 分
              </div>
              <div className="text-[10px] text-text-4">最长静默</div>
            </div>
            <div className="rounded-ctl bg-surface py-1.5">
              <div className="tnum text-sm font-semibold text-text-1">{d.silences.length}</div>
              <div className="text-[10px] text-text-4">静默段</div>
            </div>
          </div>
          {d.causes.length > 0 && (
            <p className="mt-2 text-[11px] text-text-4">
              死因：{d.causes.map((c) => `${c.label}×${c.count}`).join('、')}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
