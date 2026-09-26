import { useEffect, useState } from 'react'
import { useAddSegment, useTaskSegments } from '../queries'
import { formatDurationC, formatRange, fromLocalInputValue, minutesToDurationC } from '@/lib/datetime'
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, EmptyState, InlineAlert, Input, Label } from '@/components/ui'

export interface TaskSegmentsDialogProps {
  taskId: string | null
  taskTitle: string
  onClose: () => void
}

/** 分段编辑面板（规格 /tasks：多次执行时间段编辑） */
export function TaskSegmentsDialog({ taskId, taskTitle, onClose }: TaskSegmentsDialogProps) {
  const { data: segments = [], isLoading } = useTaskSegments(taskId)
  const add = useAddSegment()
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStartsAt('')
    setEndsAt('')
    setError(null)
  }, [taskId])

  async function submit() {
    if (!taskId) return
    const s = fromLocalInputValue(startsAt)
    const e = fromLocalInputValue(endsAt)
    if (!s || !e || e <= s) {
      setError('请填写有效的时间段（结束须晚于开始）')
      return
    }
    setError(null)
    try {
      await add.mutateAsync({ taskId, body: { startsAt: s, endsAt: e, status: 'planned', source: 'manual' } })
      setStartsAt('')
      setEndsAt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }

  return (
    <Dialog open={taskId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader title="执行时间段" description={taskTitle} />
        <DialogBody className="space-y-4">
          {error && <InlineAlert tone="crit">{error}</InlineAlert>}

          {isLoading ? (
            <div className="py-6 text-center text-[13px] text-text-3">加载中…</div>
          ) : segments.length === 0 ? (
            <EmptyState size="sm" title="暂无执行时间段" description="添加时间段后，任务将出现在日历的任务段图层中。" />
          ) : (
            <ul className="space-y-1.5">
              {segments.map((seg) => (
                <li
                  key={seg.id}
                  className="flex items-center gap-3 rounded-ctl border border-border px-3 py-2 text-[13px]"
                >
                  <span className="tnum flex-1 text-text-1">{formatRange(seg.startsAt, seg.endsAt)}</span>
                  <span className="tnum text-text-3">{formatDurationC(durationOf(seg.startsAt, seg.endsAt))}</span>
                  <span className="rounded-badge bg-surface-2 px-1.5 py-0.5 text-xs text-text-3">{seg.status}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-ctl border border-border bg-surface p-3">
            <Label>添加时间段</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-label="开始时间" />
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-label="结束时间" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              loading={add.isPending}
              onClick={() => void submit()}
            >
              添加时间段
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function durationOf(startIso: string, endIso: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000),
  )
  return formatDurationC(minutesToDurationC(minutes))
}
