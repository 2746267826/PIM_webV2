import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { isOutlookEvent, type CalendarBook, type EventResponse } from '../types'
import { useDeleteEvent, useSaveEvent } from '../queries'
import { fromLocalInputValue, toLocalInputValue } from '@/lib/datetime'
import { InlineAlert, Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Input, Label, Segmented, Select, Switch, Textarea } from '@/components/ui'

const schema = z.object({
  title: z.string().min(1, '请输入标题').max(255, '最多 255 字符'),
  calendarId: z.string().min(1, '请选择日历本'),
  isAllDay: z.boolean(),
  dtStart: z.string().min(1, '请选择开始时间'),
  dtEnd: z.string().min(1, '请选择结束时间'),
  location: z.string().max(500, '最多 500 字符'),
  description: z.string(),
  rrule: z.enum(['', 'FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY']),
})

export interface EventEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  calendars: CalendarBook[]
  /** 新建：日历拖选预填的时段 */
  initial?: { start: Date; end: Date; allDay?: boolean } | null
  /** 编辑：事件对象 */
  event?: EventResponse | null
}

const RECURRENCE_OPTIONS = [
  { value: '', label: '不重复' },
  { value: 'FREQ=DAILY', label: '每天' },
  { value: 'FREQ=WEEKLY', label: '每周' },
  { value: 'FREQ=MONTHLY', label: '每月' },
] as const

/** 日程编辑弹窗（02 §日历：重复 scope 三选；Outlook 镜像走写回 409/412 冲突 UI） */
export function EventEditorDialog({ open, onOpenChange, calendars, initial, event }: EventEditorProps) {
  const isEdit = event != null
  const isOutlook = event != null && isOutlookEvent(event)
  const hasRecurrence = event != null && (Boolean(event.rrule) || event.isSeriesMaster || Boolean(event.seriesMasterId))
  const save = useSaveEvent()
  const remove = useDeleteEvent()

  const [scope, setScope] = useState<'this' | 'series'>('this')
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ serverTitle?: string; message: string } | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      calendarId: '',
      isAllDay: false,
      dtStart: '',
      dtEnd: '',
      location: '',
      description: '',
      rrule: '',
    },
  })

  const editableCalendars = useMemo(() => calendars.filter((c) => c.canEdit || !isOutlook), [calendars, isOutlook])

  useEffect(() => {
    if (!open) return
    setError(null)
    setConflict(null)
    setScope('this')
    if (event) {
      form.reset({
        title: event.title,
        calendarId: event.calendarId,
        isAllDay: event.isAllDay,
        dtStart: toLocalInputValue(event.dtStart),
        dtEnd: toLocalInputValue(event.dtEnd),
        location: event.location ?? '',
        description: event.description ?? '',
        rrule: (event.rrule as z.infer<typeof schema>['rrule']) ?? '',
      })
    } else if (initial) {
      const start = initial.start
      const end = initial.end
      const def = calendars.find((c) => c.isDefault && c.kind === 'calendar') ?? calendars.find((c) => c.kind === 'calendar')
      form.reset({
        title: '',
        calendarId: def?.id ?? '',
        isAllDay: initial.allDay ?? false,
        dtStart: toLocalInputValue(start.toISOString()),
        dtEnd: toLocalInputValue(end.toISOString()),
        location: '',
        description: '',
        rrule: '',
      })
    }
  }, [open, event, initial, calendars, form])

  async function submit(values: z.infer<typeof schema>) {
    setError(null)
    setConflict(null)
    const dtStart = fromLocalInputValue(values.dtStart)
    const dtEnd = fromLocalInputValue(values.dtEnd)
    if (!dtStart || !dtEnd) {
      setError('时间格式不正确')
      return
    }
    if (dtEnd <= dtStart) {
      setError('结束时间必须晚于开始时间')
      return
    }
    const body: Record<string, unknown> = {
      calendarId: values.calendarId,
      title: values.title,
      description: values.description || null,
      location: values.location || null,
      dtStart,
      dtEnd,
      isAllDay: values.isAllDay,
      rrule: values.rrule || null,
      descriptionFormat: 'text',
    }
    try {
      if (isEdit && event) {
        if (isOutlook) {
          // Outlook 镜像事件：经确认流写回 Graph（409/412 冲突以业务体返回）
          const { apiPost } = await import('@/api/client')
          const result = await apiPost<{ status: string; latestEvent: EventResponse | null; errorCode: string | null; errorMessage: string | null }>(
            '/api/v1/calendar/outlook/events/writeback',
            {
              operation: 'update',
              calendarBindingId: event.outlookCalendarBindingId,
              eventId: event.id,
              draft: { ...body, uid: event.uid },
              scope: hasRecurrence ? (scope === 'this' ? 'instance' : 'series') : 'instance',
              clientOperationId: crypto.randomUUID(),
              expectedEtag: event.outlookEtag ?? undefined,
              originalEventId: event.originalEventId ?? undefined,
              recurrenceId: event.recurrenceId ?? undefined,
            },
            { allowStatuses: [409, 412] },
          )
          if (result.status === 'conflict') {
            setConflict({
              serverTitle: result.latestEvent?.title,
              message: result.errorMessage ?? '服务器上已有更新版本（HTTP 409/412 冲突），请刷新后重试。',
            })
            return
          }
          if (result.status === 'reauth-required') {
            setError('Outlook 连接需要重新授权（设置 → Microsoft 账户）')
            return
          }
        } else {
          await save.mutateAsync({
            id: event.id,
            body,
            scope: hasRecurrence ? { scope, recurrenceId: event.recurrenceId ?? undefined, originalEventId: event.originalEventId ?? undefined } : undefined,
          })
        }
      } else {
        await save.mutateAsync({ body })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败，请稍后重试')
    }
  }

  async function onDelete() {
    if (!event) return
    setError(null)
    try {
      if (isOutlook) {
        const { apiPost } = await import('@/api/client')
        const result = await apiPost<{ status: string; errorMessage: string | null }>(
          '/api/v1/calendar/outlook/events/writeback',
          {
            operation: 'delete',
            calendarBindingId: event.outlookCalendarBindingId,
            eventId: event.id,
            scope: hasRecurrence ? (scope === 'this' ? 'instance' : 'series') : 'instance',
            clientOperationId: crypto.randomUUID(),
            originalEventId: event.originalEventId ?? undefined,
            recurrenceId: event.recurrenceId ?? undefined,
          },
          { allowStatuses: [409, 412] },
        )
        if (result.status === 'conflict') {
          setConflict({ message: result.errorMessage ?? '删除冲突：服务器上已有更新版本。' })
          return
        }
        if (result.status === 'reauth-required') {
          setError('Outlook 连接需要重新授权（设置 → Microsoft 账户）')
          return
        }
      } else {
        await remove.mutateAsync({
          id: event.id,
          scope: hasRecurrence ? { scope, recurrenceId: event.recurrenceId ?? undefined, originalEventId: event.originalEventId ?? undefined } : undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '删除失败，请稍后重试')
    }
  }

  const busy = save.isPending || remove.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader
          title={isEdit ? '编辑日程' : '新建日程'}
          description={event?.isCancelled ? '该日程已取消' : undefined}
        />
        <DialogBody className="space-y-4">
          {isOutlook && (
            <InlineAlert tone="info">
              Outlook 镜像事件：保存/删除将通过写回流程同步到 Microsoft 日历。
            </InlineAlert>
          )}
          {conflict && (
            <InlineAlert tone="crit" title="写回冲突">
              {conflict.message}
              {conflict.serverTitle && <> 服务器当前标题：「{conflict.serverTitle}」。</>}
            </InlineAlert>
          )}
          {error && <InlineAlert tone="crit">{error}</InlineAlert>}

          {hasRecurrence && isEdit && (
            <div>
              <Label>重复范围</Label>
              <Segmented
                value={scope}
                onValueChange={setScope}
                options={[
                  { value: 'this', label: '仅本次' },
                  { value: 'series', label: '整个系列' },
                ]}
              />
            </div>
          )}

          <div>
            <Label htmlFor="event-title">标题</Label>
            <Input id="event-title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="mt-1 text-xs text-crit">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="event-calendar">日历本</Label>
              <Select
                id="event-calendar"
                value={form.watch('calendarId') || undefined}
                onValueChange={(v) => form.setValue('calendarId', v)}
                options={editableCalendars.map((c) => ({ value: c.id, label: c.name, disabled: !c.canEdit }))}
                placeholder="选择日历本"
              />
            </div>
            <div>
              <Label htmlFor="event-rrule">重复</Label>
              <Select
                id="event-rrule"
                value={form.watch('rrule') || ''}
                onValueChange={(v) => form.setValue('rrule', v as z.infer<typeof schema>['rrule'])}
                options={RECURRENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <Label htmlFor="event-start">开始</Label>
              <Input
                id="event-start"
                type="datetime-local"
                {...form.register('dtStart')}
              />
            </div>
            <div>
              <Label htmlFor="event-end">结束</Label>
              <Input id="event-end" type="datetime-local" {...form.register('dtEnd')} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="event-allday"
              checked={form.watch('isAllDay')}
              onCheckedChange={(v) => form.setValue('isAllDay', v)}
            />
            <Label htmlFor="event-allday" className="mb-0">全天</Label>
          </div>

          <div>
            <Label htmlFor="event-location">地点</Label>
            <Input id="event-location" {...form.register('location')} />
          </div>
          <div>
            <Label htmlFor="event-desc">描述</Label>
            <Textarea id="event-desc" rows={3} {...form.register('description')} />
          </div>
        </DialogBody>
        <DialogFooter>
          {isEdit && (
            <Button
              variant="danger-soft"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => void onDelete()}
            >
              <Trash2 className="size-4" aria-hidden /> 删除
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => void form.handleSubmit(submit)()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
