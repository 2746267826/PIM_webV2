import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus, Search, Timer } from 'lucide-react'
import { useBatchDeleteTasks, useTaskBooks, useTasksPaged, useToggleTaskComplete } from '../queries'
import { TaskEditorDialog } from '../components/task-editor-dialog'
import { TaskSegmentsDialog } from '../components/task-segments-dialog'
import { TaskDetailDialog } from '../components/entity-detail-dialogs'
import type { TaskResponse } from '../types'
import { dayEndIso, dayStartIso, formatDurationC, formatTime } from '@/lib/datetime'
import { Button, Card, Checkbox, Chip, EmptyState, Input, PageHeader, Select, Skeleton, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/utils'

type QuickFilter = 'all' | 'inbox' | 'due-today' | 'planned-today' | 'high' | 'completed'

const QUICK_OPTIONS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'inbox', label: '收集箱' },
  { value: 'due-today', label: '今日截止' },
  { value: 'planned-today', label: '今日已安排' },
  { value: 'high', label: '高优先' },
  { value: 'completed', label: '已完成' },
]

function quickToParams(filter: QuickFilter): { inbox?: boolean; status?: string; priority?: number; dueFrom?: string; dueTo?: string; plannedFrom?: string; plannedTo?: string } {
  const now = new Date()
  switch (filter) {
    case 'inbox':
      return { inbox: true }
    case 'completed':
      return { status: 'COMPLETED' }
    case 'high':
      return { priority: 9 }
    case 'due-today':
      return { dueFrom: dayStartIso(now), dueTo: dayEndIso(now) }
    case 'planned-today':
      return { plannedFrom: dayStartIso(now), plannedTo: dayEndIso(now) }
    default:
      return {}
  }
}

const PRIORITY_BADGE: Record<number, { label: string; tone: 'crit' | 'warn' | 'neutral' }> = {
  9: { label: '高', tone: 'crit' },
  5: { label: '中', tone: 'warn' },
  1: { label: '低', tone: 'neutral' },
}

/** 任务页（02 §tasks：chips 快捷筛选→服务端参数；?taskBookId= 即 URL） */
export function TasksPage() {
  const [params, setParams] = useSearchParams()
  const taskBookId = params.get('taskBookId') ?? undefined

  const [quick, setQuick] = useState<QuickFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editorTask, setEditorTask] = useState<TaskResponse | null | undefined>(undefined)
  const [editorOpen, setEditorOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<TaskResponse | null>(null)
  const [segmentsTask, setSegmentsTask] = useState<TaskResponse | null>(null)

  const { data: taskBooks = [] } = useTaskBooks()
  /*
   * 注意：GET /calendar/tasks 没有 taskBookId 查询参数（规格 calendar.md:312-328），
   * 其 calendarId 语义是「按日历过滤」——把任务本 ID 传进去会得到空结果。
   * 因此任务本筛选在客户端进行（URL 仍以 ?taskBookId= 记录状态）。
   */
  const query = useMemo(
    () => ({
      ...quickToParams(quick),
      search: search || undefined,
      page,
      pageSize: 100,
    }),
    [quick, search, page],
  )
  const tasksQuery = useTasksPaged(query)
  const data = useMemo(() => {
    if (taskBookId == null) return tasksQuery.data
    const items = (tasksQuery.data?.items ?? []).filter((t) => t.taskBookId === taskBookId)
    return { items, totalCount: items.length, page: 1, pageSize: items.length, totalPages: 1 }
  }, [tasksQuery.data, taskBookId])
  const isLoading = tasksQuery.isLoading
  const batchDelete = useBatchDeleteTasks()
  const toggleComplete = useToggleTaskComplete()

  const tasks = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  function setTaskBook(id: string | undefined) {
    setParams((p) => {
      const np = new URLSearchParams(p)
      if (id) np.set('taskBookId', id)
      else np.delete('taskBookId')
      return np
    })
    setPage(1)
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const filteredBooks = taskBooks

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="任务"
        subtitle={data ? `共 ${data.totalCount} 条` : undefined}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditorTask(null)
              setEditorOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden /> 新建任务
          </Button>
        }
      />

      {/* 快捷筛选 + 搜索 + 任务本 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={quick === o.value}
              onClick={() => {
                setQuick(o.value)
                setPage(1)
              }}
            >
              {o.label}
            </Chip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-text-4" aria-hidden />
            <Input
              placeholder="搜索任务…"
              className="w-44 pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={taskBookId}
            onValueChange={(v) => setTaskBook(v)}
            options={[{ value: '', label: '全部任务本' }, ...filteredBooks.map((b) => ({ value: b.id, label: `${b.name} (${b.taskCount})` }))]}
            placeholder="全部任务本"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 任务本树（任务本列表，选中进 URL） */}
        <aside className="hidden w-52 shrink-0 md:block">
          <Card className="p-2">
            <button
              type="button"
              onClick={() => setTaskBook(undefined)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-ctl px-2 text-[13px] transition-colors',
                !taskBookId ? 'bg-primary-soft text-primary-hover' : 'text-text-2 hover:bg-surface',
              )}
            >
              全部任务
            </button>
            {filteredBooks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setTaskBook(b.id)}
                className={cn(
                  'flex h-8 w-full items-center gap-2 rounded-ctl px-2 text-[13px] transition-colors',
                  taskBookId === b.id ? 'bg-primary-soft text-primary-hover' : 'text-text-2 hover:bg-surface',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-left">{b.name}</span>
                <span className="tnum text-[11px] text-text-4">{b.taskCount}</span>
              </button>
            ))}
          </Card>
        </aside>

        {/* 任务列表 */}
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <EmptyState
                title="没有符合条件的任务"
                description="切换筛选条件，或新建一个任务。"
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditorTask(null)
                      setEditorOpen(true)
                    }}
                  >
                    <Plus className="size-4" aria-hidden /> 新建任务
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="divide-y divide-divider">
              {tasks.map((task) => {
                const done = task.status === 'COMPLETED'
                const badge = PRIORITY_BADGE[task.priority]
                const book = taskBooks.find((b) => b.id === task.taskBookId)
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface',
                      selected.has(task.id) && 'bg-primary-soft/50',
                    )}
                  >
                    <Checkbox
                      checked={selected.has(task.id)}
                      onCheckedChange={(v) => toggleSelect(task.id, v)}
                      ariaLabel={`选择 ${task.title}`}
                    />
                    <span
                      className={cn('h-5 w-[3px] shrink-0 rounded-full', task.priority >= 9 ? 'bg-crit' : task.priority >= 5 ? 'bg-warn' : 'bg-border-strong')}
                      aria-hidden
                    />
                    <button
                      type="button"
                      aria-label={done ? '标记未完成' : '标记完成'}
                      onClick={() => toggleComplete.mutate({ task, completed: !done })}
                      className={cn(
                        'grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors outline-none',
                        done ? 'border-ok bg-ok text-white' : 'border-border-strong hover:border-primary',
                      )}
                    >
                      {done && <span className="size-1.5 rounded-full bg-white" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left outline-none"
                      onClick={() => setDetailTask(task)}
                    >
                      <span className={cn('block truncate text-sm', done ? 'text-text-4 line-through' : 'text-text-1')}>
                        {task.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-text-4">
                        {book && <span>{book.name}</span>}
                        {task.due && <span className="tnum text-warn">截止 {formatTime(task.due)}</span>}
                        {task.dtStart && <span className="tnum">已排 {formatTime(task.dtStart)}</span>}
                        {task.estimatedDuration && <span>预计 {formatDurationC(task.estimatedDuration)}</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {badge && <StatusBadge tone={badge.tone} dot={false}>{badge.label}</StatusBadge>}
                      {done && <StatusBadge tone="ok" dot={false}>已完成</StatusBadge>}
                      <button
                        type="button"
                        aria-label={`执行时间段：${task.title}`}
                        title="执行时间段"
                        onClick={() => setSegmentsTask(task)}
                        className="rounded-ctl p-1.5 text-text-4 transition-colors outline-none hover:bg-surface-2 hover:text-text-1"
                      >
                        <Timer className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-[13px] text-text-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                上一页
              </Button>
              <span className="tnum">
                {page} / {totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                下一页
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 多选批操作条（吸底） */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-bg px-4 py-2.5 shadow-overlay md:pl-[280px] lg:pl-[296px]">
          <span className="tnum text-[13px] text-text-2">已选 {selected.size} 项</span>
          <Button variant="secondary" size="sm" onClick={() => setSelected(new Set(tasks.map((t) => t.id)))}>
            全选本页
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
            取消选择
          </Button>
          <Button
            variant="danger-soft"
            size="sm"
            className="ml-auto"
            loading={batchDelete.isPending}
            onClick={async () => {
              const ids = [...selected]
              const confirmed = window.confirm(`删除选中的 ${ids.length} 个任务？（将进入回收站）`)
              if (!confirmed) return
              await batchDelete.mutateAsync(ids)
              setSelected(new Set())
            }}
          >
            删除选中
          </Button>
        </div>
      )}

      <TaskEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        taskBooks={taskBooks}
        task={editorTask ?? null}
      />
      <TaskSegmentsDialog
        taskId={segmentsTask?.id ?? null}
        taskTitle={segmentsTask?.title ?? ''}
        onClose={() => setSegmentsTask(null)}
      />

      {/* 详情（只读）→ 点「编辑」才进编辑弹窗 */}
      <TaskDetailDialog
        task={detailTask}
        taskBookName={taskBooks.find((b) => b.id === detailTask?.taskBookId)?.name}
        onClose={() => setDetailTask(null)}
        onEdit={(t) => {
          setDetailTask(null)
          setEditorTask(t)
          setEditorOpen(true)
        }}
      />
    </div>
  )
}
