import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deferredIntervalMs, standardIntervalMs } from '@/lib/polling'
import { calendarsApi, checklistApi, eventsApi, layersApi, segmentsApi, taskBooksApi, tasksApi } from './api'
import type { TasksPagedParams } from './types'

/* ── queryKey 工厂（CONVENTIONS §4：禁止散写字符串数组） ───── */

export const calendarKeys = {
  calendars: (kind?: string) => ['calendar', 'calendars', kind ?? 'all'] as const,
  taskBooks: ['calendar', 'task-books'] as const,
  events: (start: string, end: string) => ['calendar', 'events', start, end] as const,
  tasks: (params: TasksPagedParams) => ['calendar', 'tasks', 'paged', params] as const,
  tasksAll: ['calendar', 'tasks', 'all'] as const,
  layers: (start: string, end: string, layers: string, outlookOnly: boolean) =>
    ['calendar', 'layers', start, end, layers, outlookOnly] as const,
  segments: (taskId: string) => ['calendar', 'task-segments', taskId] as const,
}

/** 今日页依赖日历数据：变更后一并失效 */
const DEPENDENT_PREFIXES = [['today']] as const

function invalidateCalendar(qc: ReturnType<typeof useQueryClient>, extra: readonly (readonly string[])[] = []) {
  for (const key of [
    calendarKeys.calendars(),
    calendarKeys.taskBooks,
    calendarKeys.tasksAll,
    ['calendar', 'events'],
    ['calendar', 'tasks', 'paged'],
    ['calendar', 'layers'],
    ['calendar', 'task-segments'],
    ...DEPENDENT_PREFIXES,
    ...extra,
  ]) {
    void qc.invalidateQueries({ queryKey: [...key] })
  }
}

/* ── 查询 hooks ───────────────────────────────────────────── */

export function useCalendars(kind?: 'calendar' | 'task') {
  return useQuery({
    queryKey: calendarKeys.calendars(kind),
    queryFn: () => calendarsApi.list(kind),
  })
}

export function useTaskBooks() {
  return useQuery({
    queryKey: calendarKeys.taskBooks,
    queryFn: taskBooksApi.list,
    staleTime: 60_000,
  })
}

/** 日历网格事件（范围+分页分支；延迟轮询） */
export function useEvents(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: calendarKeys.events(start, end),
    queryFn: () => eventsApi.listPaged({ start, end, page: 1, pageSize: 100 }),
    enabled,
    refetchInterval: () => deferredIntervalMs(),
  })
}

/** 收件箱侧板（旧版全量分支 + 客户端过滤；标准轮询） */
export function useInboxTasks() {
  return useQuery({
    queryKey: calendarKeys.tasksAll,
    queryFn: () => tasksApi.listAll(),
    refetchInterval: () => standardIntervalMs(),
  })
}

export function useLayers(
  start: string,
  end: string,
  layers: string,
  outlookOnly: boolean,
  enabled = true,
) {
  return useQuery({
    queryKey: calendarKeys.layers(start, end, layers, outlookOnly),
    queryFn: () => layersApi.list({ start, end, layers, outlookOnly }),
    enabled,
    refetchInterval: () => deferredIntervalMs(),
  })
}

export function useTaskSegments(taskId: string | null) {
  return useQuery({
    queryKey: calendarKeys.segments(taskId ?? ''),
    queryFn: () => segmentsApi.list(taskId!),
    enabled: taskId != null,
  })
}

export function useTasksPaged(params: TasksPagedParams) {
  return useQuery({
    queryKey: calendarKeys.tasks(params),
    queryFn: () => tasksApi.listPaged(params),
  })
}

/* ── 变更 hooks ───────────────────────────────────────────── */

export function useCreateCalendar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: calendarsApi.create,
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useRenameCalendar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; color?: string } }) =>
      calendarsApi.rename(id, body),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useDeleteCalendar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => calendarsApi.remove(id),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useSaveEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      body: Record<string, unknown>
      scope?: { scope?: 'this' | 'series'; recurrenceId?: string; originalEventId?: string }
    }) => (input.id ? eventsApi.update(input.id, input.body, input.scope) : eventsApi.create(input.body)),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      scope?: { scope?: 'this' | 'series'; recurrenceId?: string; originalEventId?: string }
    }) => eventsApi.remove(input.id, input.scope),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useSaveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; body: Record<string, unknown> }) =>
      input.id ? tasksApi.update(input.id, input.body) : tasksApi.create(input.body),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useBatchDeleteTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => tasksApi.batchDelete(ids),
    onSuccess: () => invalidateCalendar(qc),
  })
}

/** 拖放排期：成功后任务与图层全部失效 */
export function usePlanTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { plannedStart: string; plannedEnd?: string; estimatedDuration?: string }
    }) => tasksApi.plan(id, body),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useToggleTaskComplete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ task, completed }: { task: { id: string }; completed: boolean }) =>
      tasksApi.update(task.id, {
        status: completed ? 'COMPLETED' : 'NEEDS-ACTION',
        percentComplete: completed ? 100 : 0,
      }),
    onSuccess: () => invalidateCalendar(qc),
  })
}

export function useChecklistMutations() {
  const qc = useQueryClient()
  const invalidate = (taskId: string) => void qc.invalidateQueries({ queryKey: calendarKeys.segments(taskId) })
  return {
    add: useMutation({
      mutationFn: ({ taskId, body }: { taskId: string; body: { title: string; sortOrder?: number } }) =>
        checklistApi.add(taskId, body),
      onSuccess: (_d, v) => invalidate(v.taskId),
    }),
    update: useMutation({
      mutationFn: ({ taskId, itemId, body }: { taskId: string; itemId: string; body: { title?: string; isDone?: boolean } }) =>
        checklistApi.update(taskId, itemId, body),
      onSuccess: (_d, v) => invalidate(v.taskId),
    }),
    remove: useMutation({
      mutationFn: ({ taskId, itemId }: { taskId: string; itemId: string }) =>
        checklistApi.remove(taskId, itemId),
      onSuccess: (_d, v) => invalidate(v.taskId),
    }),
  }
}

export function useAddSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      body,
    }: {
      taskId: string
      body: { startsAt: string; endsAt: string; status: string; source: string }
    }) => segmentsApi.add(taskId, body),
    onSuccess: () => invalidateCalendar(qc),
  })
}
