import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlay } from '@/hooks/useOverlay'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Remove o padding interno do corpo */
  bare?: boolean
  className?: string
  hideClose?: boolean
}

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
}

/** Diálogo centralizado no desktop e "bottom sheet" no celular */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', bare, className, hideClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  return createPortal(
    <div data-overlay-root className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-zinc-950/50 backdrop-blur-[2px] dark:bg-black/70" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none sm:rounded-2xl',
          'animate-slide-up sm:animate-scale-in',
          SIZES[size],
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 pt-3 pb-4 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-ink-3">
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <IconButton label="Fechar" size="icon-sm" onClick={onClose} className="-mr-1.5">
              <X />
            </IconButton>
          )}
        </header>
        <div className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain', !bare && 'px-5 py-5')}>{children}</div>
        {footer && (
          <footer className="pb-safe flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
