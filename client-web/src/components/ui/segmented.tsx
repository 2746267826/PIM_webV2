import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  title?: string
  disabled?: boolean
}

export interface SegmentedProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'md'
  className?: string
}

/** 分段控件（规格"胶囊型单选切换"）：容器 #F1F5F9，选中白底+主色字+卡片阴影 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as T)
      }}
      className={cn('inline-flex items-center rounded-full bg-surface-2 p-[3px]', className)}
      role="tablist"
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          title={o.title}
          disabled={o.disabled}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 font-medium text-text-3 transition-colors duration-150 outline-none hover:text-text-1 disabled:opacity-50 data-[state=on]:bg-bg data-[state=on]:text-primary data-[state=on]:shadow-card',
            size === 'md' ? 'h-7 text-[13px]' : 'h-6 px-2.5 text-xs',
          )}
        >
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
