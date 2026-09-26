import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral'

const toneDot: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
  info: 'bg-info',
  neutral: 'bg-neutral',
}

const toneSoft: Record<Tone, string> = {
  ok: 'border-ok-border bg-ok-soft text-ok',
  warn: 'border-warn-border bg-warn-soft text-warn',
  crit: 'border-crit-border bg-crit-soft text-crit',
  info: 'border-info-border bg-info-soft text-info',
  neutral: 'border-border bg-surface text-text-3',
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  dot?: boolean
}

/** 状态徽标（语义短标签：健康/告警/离线/同步中等） */
export function StatusBadge({
  tone = 'neutral',
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-badge border px-2 text-xs font-medium whitespace-nowrap',
        toneSoft[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} aria-hidden />}
      {children}
    </span>
  )
}
