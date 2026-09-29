import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  label: string
  icon?: ReactNode
  onSelect?: () => void
  href?: string
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  separatorBefore?: boolean
}

interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-controls': string }) => ReactNode
  items: DropdownItem[]
  align?: 'start' | 'end'
  className?: string
  header?: ReactNode
}

/** Menu suspenso acessível (setas, Enter, Esc, clique fora) */
export function Dropdown({ trigger, items, align = 'end', className, header }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const navigate = useNavigate()
  const visible = items.filter((i) => !i.hidden)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus())
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      nodes[(index + 1) % nodes.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const select = (item: DropdownItem) => {
    setOpen(false)
    if (item.href) navigate(item.href)
    item.onSelect?.()
  }

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      {trigger({
        open,
        toggle: () => setOpen((o) => !o),
        id: `${id}-trigger`,
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': `${id}-menu`,
      })}
      {open && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-trigger`}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute top-full z-40 mt-2 min-w-52 origin-top animate-scale-in overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-zinc-950/10 dark:shadow-black/50',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {header}
          {visible.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <div className="my-1.5 h-px bg-line" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => select(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
                  item.danger
                    ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10'
                    : 'text-ink hover:bg-surface-2 focus:bg-surface-2 [&_svg]:text-ink-3',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
