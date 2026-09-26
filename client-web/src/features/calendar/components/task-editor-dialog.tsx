import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Plus, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useChecklistMutations, useDeleteTask, useSaveTask } from '../queries'
import type { TaskBook, TaskResponse } from '../types'
import { fromLocalInputValue, toLocalInputValue } from '@/lib/datetime'
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Input, Label, Select, Textarea } from '@/components/ui'

const schema = z.object({
  title: z.string().min(1, '请输入标题').max(255, '最多 255 字符'),
  taskBookId: z.string(),
  priority: z.string(),
  estimated: z.string(),
  due: z.string(),
  description: z.string(),
})

const PRIORITY_OPTIONS = [
  { value: '1', label: '低' },
  { value: '5', label: '中' },
  { value: '9', label: '高' },
]

const DURATION_OPTIONS = [
  { value: '', label: '不限' },
  { value: '00:15:00', label: '15 分钟' },
  { value: '00:30:00', label: '30 分钟' },
  { value: '01:00:00', label: '1 小时' },
  { value: '01:30:00', label: '1.5 小时' },
  { value: '02:00:00', label: '2 小时' },
  { value: '04:00:00', label: '4 小时' },
]

export interface TaskEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskBooks: TaskBook[]
  task?: TaskResponse | null
}

/** 任务编辑弹窗（属性 + 清单；时间段在独立面板 TaskSegmentsDialog） */
export function TaskEditorDialog({ open, onOpenChange, taskBooks, task }: TaskEditorProps) {
  const isEdit = task != null
  const save = useSaveTask()
  const remove = useDeleteTask()
  const checklist = useChecklistMutations()
  const [error, setError] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', taskBookId: '', priority: '5', estimated: '', due: '', description: '' },
  })

  useEffect(() => {
    if (!open) return
    setError(null)
    setNewItem('')
    if (task) {
      form.reset({
        title: task.title,
        taskBookId: task.taskBookId ?? '',
        priority: String(task.priority),
        estimated: task.estimatedDuration ?? '',
        due: toLocalInputValue(task.due),
        description: task.description ?? '',
      })
    } else {
      form.reset({ title: '', taskBookId: '', priority: '5', estimated: '', due: '', description: '' })
    }
  }, [open, task, form])

  async function submit(values: z.infer<typeof schema>) {
    setError(null)
    const due = fromLocalInputValue(values.due)
    const body: Record<string, unknown> = {
      title: values.title,
      description: values.description || null,
      priority: Number(values.priority),
      due,
      estimatedDuration: values.estimated || null,
      taskBookId: values.taskBookId || null,
    }
    try {
      await save.mutateAsync({ id: task?.id, body })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败，请稍后重试')
    }
  }

  const checklistItems = task?.checklistItems ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader title={isEdit ? '编辑任务' : '新建任务'} />
        <DialogBody className="space-y-4">
          {error && <InlineError message={error} />}
          <div>
            <Label htmlFor="task-title">标题</Label>
            <Input id="task-title" {...form.register('title')} autoFocus />
            {form.formState.errors.title && (
              <p className="mt-1 text-xs text-crit">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="task-book">任务本</Label>
              <Select
                id="task-book"
                value={form.watch('taskBookId') || undefined}
                onValueChange={(v) => form.setValue('taskBookId', v)}
                options={taskBooks.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="无"
              />
            </div>
            <div>
              <Label htmlFor="task-priority">优先级</Label>
              <Select
                id="task-priority"
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v)}
                options={PRIORITY_OPTIONS}
              />
            </div>
            <div>
              <Label htmlFor="task-estimated">预计时长</Label>
              <Select
                id="task-estimated"
                value={form.watch('estimated')}
                onValueChange={(v) => form.setValue('estimated', v)}
                options={DURATION_OPTIONS}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="task-due">截止时间</Label>
            <Input id="task-due" type="datetime-local" {...form.register('due')} />
          </div>
          <div>
            <Label htmlFor="task-desc">描述</Label>
            <Textarea id="task-desc" rows={3} {...form.register('description')} />
          </div>

          {isEdit && (
            <>
              <Divider label="检查清单" />
              <div className="space-y-1.5">
                {checklistItems.map((item) => (
                  <div key={item.id} className="group flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={item.isDone ? '取消完成' : '标记完成'}
                      onClick={() =>
                        checklist.update.mutate({ taskId: task.id, itemId: item.id, body: { isDone: !item.isDone } })
                      }
                      className={`grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors outline-none ${
                        item.isDone ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong bg-bg'
                      }`}
                    >
                      {item.isDone && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </button>
                    <span className={`flex-1 text-[13px] ${item.isDone ? 'text-text-4 line-through' : 'text-text-1'}`}>
                      {item.title}
                    </span>
                    <button
                      type="button"
                      aria-label="删除清单项"
                      onClick={() => checklist.remove.mutate({ taskId: task.id, itemId: item.id })}
                      className="rounded-ctl p-0.5 text-text-4 opacity-0 transition-opacity outline-none group-hover:opacity-100 hover:text-crit"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
                <form
                  className="flex gap-2 pt-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const title = newItem.trim()
                    if (!title) return
                    checklist.add.mutate({
                      taskId: task.id,
                      body: { title, sortOrder: checklistItems.length },
                    })
                    setNewItem('')
                  }}
                >
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="添加清单项，回车提交"
                    className="h-8"
                  />
                  <Button variant="secondary" size="sm" type="submit">
                    <Plus className="size-4" aria-hidden /> 添加
                  </Button>
                </form>
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {isEdit && (
            <Button
              variant="danger-soft"
              className="mr-auto"
              loading={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync(task.id)
                onOpenChange(false)
              }}
            >
              <Trash2 className="size-4" aria-hidden /> 删除
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => void form.handleSubmit(submit)()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InlineError({ message }: { message: string }) {
  return <div className="rounded-ctl border border-crit-border bg-crit-soft px-3 py-2 text-[13px] text-crit">{message}</div>
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-medium text-text-3">{label}</span>
      <span className="h-px flex-1 bg-divider" />
    </div>
  )
}
