import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CalendarPlus, NotebookPen, Plus, SquareCheckBig, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAB_ACTIONS = [
  { key: 'note', label: '写闪念', icon: NotebookPen, to: '/quick-notes' },
  { key: 'task', label: '建任务', icon: SquareCheckBig, to: '/tasks' },
  { key: 'event', label: '排日程', icon: CalendarPlus, to: '/calendar' },
] as const

/** 快捷记录 FAB（规格 01 §5：除 /quick-notes 与内嵌页外所有页展示） */
export function GlobalFab() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (pathname.startsWith('/quick-notes') || pathname.startsWith('/embed/')) return null

  return (
    <div className="fixed right-5 bottom-5 z-30 flex flex-col items-end gap-2 md:right-6 md:bottom-6">
      {open && (
        <div className="flex flex-col items-end gap-1.5 animate-[pim-pop-in_150ms_ease-out]">
          {FAB_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate(action.to)
                }}
                className="flex h-9 items-center gap-2 rounded-full border border-border bg-bg py-1 pr-4 pl-2 text-[13px] font-medium text-text-1 shadow-overlay transition-colors hover:border-border-strong outline-none"
              >
                <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-primary">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {action.label}
              </button>
            )
          })}
        </div>
      )}
      <button
        type="button"
        aria-label={open ? '收起快捷操作' : '快捷记录'}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid size-14 place-items-center rounded-full text-primary-fg shadow-modal transition-colors duration-150 outline-none',
          open ? 'bg-text-1' : 'bg-primary hover:bg-primary-hover',
        )}
      >
        {open ? <X className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
      </button>
    </div>
  )
}
