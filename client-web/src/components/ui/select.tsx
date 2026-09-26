import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SelectProps<T extends string> {
  value: T | undefined
  onValueChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}

/** 下拉选择（Radix Select 的紧凑封装，popper 跟随触发器宽度） */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  id,
  ariaLabel,
}: SelectProps<T>) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-9 min-w-32 items-center justify-between gap-1.5 rounded-ctl border border-border bg-bg px-3 text-sm text-text-1 transition-colors duration-150 outline-none hover:border-border-strong focus:border-primary disabled:opacity-50 data-[placeholder]:text-text-4',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-text-3" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-ctl border border-border bg-bg shadow-overlay animate-[pim-pop-in_150ms_ease-out]"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="flex h-8 cursor-default items-center gap-2 rounded-ctl px-2.5 text-[13px] text-text-1 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface data-[state=checked]:font-medium data-[state=checked]:text-primary"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Check className="size-3.5" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
