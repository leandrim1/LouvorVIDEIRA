import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
}

interface TabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  items: Array<TabItem<T>>
  label: string
  variant?: 'underline' | 'pills'
  className?: string
}

/** Lista de abas acessível (setas esquerda/direita, Home/End) */
export function Tabs<T extends string>({ value, onChange, items, label, variant = 'underline', className }: TabsProps<T>) {
  const id = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent) => {
    const index = items.findIndex((i) => i.value === value)
    let next = -1
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    if (next < 0) return
    event.preventDefault()
    onChange(items[next].value)
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'scrollbar-none relative flex overflow-x-auto',
        variant === 'underline' ? 'gap-5 border-b border-line' : 'gap-1.5',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors [&_svg]:size-4',
              variant === 'underline'
                ? cn('h-11 -mb-px border-b-2', active ? 'border-brand-600 text-ink dark:border-brand-400' : 'border-transparent text-ink-3 hover:text-ink')
                : cn(
                    'h-9 rounded-full px-3.5',
                    active
                      ? 'bg-ink text-canvas shadow-sm'
                      : 'bg-surface text-ink-2 ring-1 ring-line ring-inset hover:bg-surface-2 hover:text-ink',
                  ),
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold',
                  active && variant === 'pills' ? 'bg-canvas/20 text-canvas' : 'bg-surface-3 text-ink-2',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
