import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '@/hooks/useOverlay'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Largura no desktop */
  width?: 'sm' | 'md' | 'lg'
  /** `auto`: bottom sheet no celular e painel lateral no desktop */
  side?: 'auto' | 'right' | 'bottom'
}

const WIDTHS = { sm: 'lg:max-w-sm', md: 'lg:max-w-md', lg: 'lg:max-w-xl' }

export function Drawer({ open, onClose, title, description, children, footer, width = 'md', side = 'auto' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  const bottom = side === 'bottom' || side === 'auto'
  const right = side === 'right'

  return createPortal(
    <div data-overlay-root className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-zinc-950/40 backdrop-blur-[2px] dark:bg-black/70" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col border-line bg-surface shadow-2xl outline-none',
          bottom &&
            'inset-x-0 bottom-0 max-h-[90dvh] animate-slide-up rounded-t-3xl border-t',
          side === 'auto' &&
            'lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-full lg:animate-slide-left lg:rounded-none lg:border-t-0 lg:border-l',
          right && 'inset-y-0 right-0 w-full max-w-md animate-slide-left border-l',
          side === 'auto' && WIDTHS[width],
        )}
      >
        <div className={cn('mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong', side === 'auto' ? 'lg:hidden' : right && 'hidden')} aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-3 pb-3 lg:border-b lg:border-line lg:pt-5 lg:pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-ink-3">{description}</div>}
          </div>
          <IconButton label="Fechar" size="icon-sm" onClick={onClose} className="-mr-1.5">
            <X />
          </IconButton>
        </header>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 lg:pt-5">{children}</div>
        {footer && <footer className="pb-safe flex shrink-0 gap-2 border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
