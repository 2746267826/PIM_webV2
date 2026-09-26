import { useState } from 'react'
import { Plus, Repeat } from 'lucide-react'
import { useCreateHabit, useHabits } from '../queries'
import { notifySuccess } from '@/lib/notify'
import { Button, Card, CardTitle, EmptyState, Input, Label, PageHeader, Segmented, Select, StatusBadge } from '@/components/ui'

type Tab = 'active' | 'planned' | 'archived'

const CADENCE_OPTIONS = [
  { value: 'Daily', label: '每日' },
  { value: 'Weekly', label: '每周' },
  { value: 'Monthly', label: '每月' },
]

/** 习惯页（02 §habits：执行中/规划/归档三标签 + 规则创建 + 只读规则卡） */
export function HabitsPage() {
  const [tab, setTab] = useState<Tab>('active')
  const { data: habits = [] } = useHabits()
  const create = useCreateHabit()
  const [title, setTitle] = useState('')
  const [cadence, setCadence] = useState('Daily')

  const filtered = habits.filter((h) =>
    tab === 'archived' ? h.status === 'Archived' : tab === 'active' ? h.status === 'Active' : h.source !== 'manual',
  )

  return (
    <div>
      <PageHeader
        title="习惯"
        subtitle="习惯规则中心（完成历史与日历投射为占位，由后端规则引擎生成）"
        actions={<Segmented value={tab} onValueChange={setTab} options={[
          { value: 'active', label: '执行中' },
          { value: 'planned', label: '规划' },
          { value: 'archived', label: '归档' },
        ]} />}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* 创建表单 */}
        <Card className="h-fit p-4">
          <CardTitle>创建习惯规则</CardTitle>
          <p className="mt-1 text-xs text-text-3">时间段规则将生成日历图层占位（由后端规则引擎投射）。</p>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const t = title.trim()
              if (!t) return
              await create.mutateAsync({ title: t, cadence })
              notifySuccess('习惯已创建')
              setTitle('')
            }}
          >
            <div>
              <Label htmlFor="habit-title">标题</Label>
              <Input id="habit-title" placeholder="如：每天阅读 30 分钟" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="habit-cadence">频率</Label>
              <Select id="habit-cadence" value={cadence} onValueChange={setCadence} options={CADENCE_OPTIONS} />
            </div>
            <Button type="submit" variant="primary" className="w-full" loading={create.isPending}>
              <Plus className="size-4" aria-hidden /> 创建习惯
            </Button>
          </form>
        </Card>

        {/* 规则卡列表 */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <EmptyState icon={Repeat} title="暂无习惯规则" description="左侧创建第一条习惯。" />
            </Card>
          ) : (
            filtered.map((h) => (
              <Card key={h.id} className="flex items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-ctl bg-primary-soft text-primary">
                  <Repeat className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-1">{h.title}</div>
                  <div className="text-xs text-text-3">
                    {CADENCE_OPTIONS.find((c) => c.value === h.cadence)?.label ?? h.cadence} · 来源 {h.source}
                  </div>
                </div>
                <StatusBadge tone={h.status === 'Active' ? 'ok' : 'neutral'} dot={false}>
                  {h.status === 'Active' ? '执行中' : h.status}
                </StatusBadge>
              </Card>
            ))
          )}
          <Card className="p-4">
            <CardTitle className="text-[13px]">完成历史</CardTitle>
            <p className="mt-1 text-xs text-text-4">占位面板：完成历史将由习惯发生记录聚合（后端规划中）。</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
