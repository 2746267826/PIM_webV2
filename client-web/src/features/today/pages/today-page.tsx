import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, ChevronRight, Hammer } from 'lucide-react'
import { useBusinessDate, useTodayRegistry, useTodaySection } from '../queries'
import type { TodaySectionRef, TodaySectionStatus } from '../api'
import { formatRange, formatTime } from '@/lib/datetime'
import { Card, CardTitle, EmptyState, InlineAlert, PageHeader, Skeleton, StatusBadge, type Tone } from '@/components/ui'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<TodaySectionStatus, Tone> = {
  available: 'ok',
  normal: 'ok',
  empty: 'neutral',
  warning: 'warn',
  critical: 'crit',
  unavailable: 'neutral',
}

const STATUS_LABEL: Record<TodaySectionStatus, string> = {
  available: '可用',
  normal: '正常',
  empty: '空',
  warning: '警告',
  critical: '故障',
  unavailable: '不可用',
}

/* ── 分区壳（规格：标题/副标题/徽标 + 条目 + 空提示） ──────── */

interface SectionItemView {
  key: string
  title: string
  meta?: string
}

function extractItems(data: unknown): SectionItemView[] {
  if (data == null || typeof data !== 'object') return []
  // 载荷形态随 kind 而异：{items:[]} 或直接为数组（防御式）
  const raw = Array.isArray(data) ? data : (data as Record<string, unknown>).items
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 8).map((item, index) => {
    const o = (item ?? {}) as Record<string, unknown>
    const title = String(o.title ?? o.name ?? o.label ?? o.message ?? `条目 ${index + 1}`)
    const start = (o.startsAt ?? o.start ?? o.scheduledAt) as string | undefined
    const end = (o.endsAt ?? o.end) as string | undefined
    const meta =
      start && end
        ? formatRange(String(start), String(end))
        : start
          ? formatTime(String(start))
          : o.value != null
            ? String(o.value)
            : undefined
    return { key: String(o.id ?? o.objectId ?? index), title, meta }
  })
}

function SectionShell({
  section,
  items,
  loading,
  error,
  onItemClick,
}: {
  section: TodaySectionRef
  items: SectionItemView[]
  loading?: boolean
  error?: string | null
  onItemClick?: (item: SectionItemView) => void
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-2">
        <CardTitle className="truncate">{section.id.split('.').slice(1).join(' ') || section.id}</CardTitle>
        <StatusBadge tone={STATUS_TONE[section.status]} className="ml-auto shrink-0">
          {STATUS_LABEL[section.status]}
        </StatusBadge>
      </div>
      <div className="mt-2 min-h-0 flex-1">
        {loading ? (
          <div className="space-y-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <InlineAlert tone="crit">{error}</InlineAlert>
        ) : items.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-text-4">暂无内容</p>
        ) : (
          <ul className="divide-y divide-divider">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  disabled={!onItemClick}
                  className="flex w-full items-center gap-3 py-1.5 text-left text-[13px] outline-none disabled:cursor-default"
                >
                  <span className="min-w-0 flex-1 truncate text-text-1">{item.title}</span>
                  {item.meta && <span className="tnum shrink-0 text-xs text-text-3">{item.meta}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

/* ── 单分区宿主（按 kind 分发；pc./operations. 延迟轮询） ──── */

function TodaySectionHost({ section, date }: { section: TodaySectionRef; date: string }) {
  const navigate = useNavigate()
  const poll = section.kind.startsWith('pc.') || section.kind.startsWith('operations.')
  const { data, isLoading } = useTodaySection(section.id, date, poll)

  const items = useMemo(() => extractItems(data?.data), [data])
  const error = data?.error?.message ?? null

  const onItemClick = () => {
    // 分区条目点击：日程类跳日历、任务类跳任务页（对象级编辑弹窗待分区 schema 固化后接入）
    if (section.kind.startsWith('calendar.task')) navigate('/tasks')
    else if (section.kind.startsWith('calendar.')) navigate('/calendar')
  }

  return (
    <SectionShell
      section={section}
      items={items}
      loading={isLoading}
      error={error}
      onItemClick={onItemClick}
    />
  )
}

/* ── 运维与状态手风琴（operations.* 分区归入折叠区） ──────── */

function OpsAccordion({ sections, date }: { sections: TodaySectionRef[]; date: string }) {
  const [open, setOpen] = useState(false)
  if (sections.length === 0) return null
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-ctl px-1 py-2 text-left outline-none"
      >
        {open ? <ChevronDown className="size-4 text-text-3" aria-hidden /> : <ChevronRight className="size-4 text-text-3" aria-hidden />}
        <h2 className="text-sm font-semibold text-text-1">运维与状态</h2>
        <span className="tnum text-xs text-text-4">({sections.length})</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((s) => (
            <TodaySectionHost key={s.id} section={s} date={date} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ── 页面 ─────────────────────────────────────────────────── */

export function TodayPage() {
  const date = useBusinessDate()
  const { data: registry, isLoading, isError, error } = useTodayRegistry(date)
  const navigate = useNavigate()

  const groups = useMemo(() => {
    const sections = registry?.sections ?? []
    return {
      action: sections.filter((s) => s.kind.startsWith('calendar.')),
      data: sections.filter((s) => s.kind.startsWith('pc.')),
      ops: sections.filter((s) => s.kind.startsWith('operations.')),
      unknown: sections.filter((s) => !s.kind.startsWith('calendar.') && !s.kind.startsWith('pc.') && !s.kind.startsWith('operations.')),
    }
  }, [registry])

  const weekday = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <PageHeader title="今日" subtitle={weekday} />

      {isError && (
        <InlineAlert tone="crit" title="今日分区加载失败">
          {error instanceof Error ? error.message : '请稍后重试'}
        </InlineAlert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 行动格 */}
          {groups.action.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium text-text-3">行动</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {groups.action.map((s) => (
                  <TodaySectionHost key={s.id} section={s} date={date} />
                ))}
              </div>
            </section>
          )}

          {/* 数据条 */}
          {groups.data.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium text-text-3">数据</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {groups.data.map((s) => (
                  <TodaySectionHost key={s.id} section={s} date={date} />
                ))}
              </div>
            </section>
          )}

          {/* 运维与状态（可折叠） */}
          <OpsAccordion sections={groups.ops} date={date} />

          {/* 未知区块（规格：显示"未知区块"占位） */}
          {groups.unknown.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium text-text-3">其它</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {groups.unknown.map((s) => (
                  <Card key={s.id} className="p-4">
                    <CardTitle className="flex items-center gap-1.5">
                      <Hammer className="size-3.5 text-text-4" aria-hidden />
                      未知区块
                    </CardTitle>
                    <p className="mono mt-2 truncate text-xs text-text-4">{s.kind}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* 全空 */}
          {registry && registry.sections.length === 0 && (
            <Card>
              <EmptyState
                title="今天还没有分区数据"
                description="创建日程或任务后，这里会汇总你的一天。"
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/calendar')}
                    className={cn('rounded-ctl bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-fg hover:bg-primary-hover')}
                  >
                    去安排日程
                  </button>
                }
              />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
