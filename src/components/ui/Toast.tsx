import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { ToastContext, type ToastApi, type ToastItem, type ToastVariant } from '@/contexts/toast'
import { cn, generateId } from '@/lib/utils'

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="text-emerald-500" />,
  error: <XCircle className="text-red-500" />,
  info: <Info className="text-sky-500" />,
  warning: <AlertTriangle className="text-amber-500" />,
}

const DURATION = 4000

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useCallback(() => {
    timer.current = setTimeout(() => onDismiss(toast.id), toast.variant === 'error' ? DURATION * 1.5 : DURATION)
  }, [onDismiss, toast.id, toast.variant])
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  useEffect(() => {
    start()
    return stop
  }, [start])

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={stop}
      onMouseLeave={start}
      className="pointer-events-auto flex w-full animate-fade-up items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 pr-2.5 shadow-lg shadow-zinc-950/10 dark:shadow-black/40 [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0"
    >
      {ICONS[toast.variant]}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[13px] break-words text-ink-2">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
            className="mt-2 text-[13px] font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Fechar notificação"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback((toast: Omit<ToastItem, 'id'>) => {
    setToasts((list) => [...list.slice(-3), { ...toast, id: generateId() }])
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ variant: 'success', title, description }),
      error: (title, description) => show({ variant: 'error', title, description }),
      info: (title, description) => show({ variant: 'info', title, description }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className={cn(
            'pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
            'sm:top-auto sm:bottom-0 sm:left-auto sm:w-[400px] sm:items-end sm:p-5',
          )}
        >
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
