import { useCallback, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { ConfirmContext, type ConfirmOptions } from '@/contexts/confirm'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmationDialogProps extends ConfirmOptions {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmationDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  loading,
}: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      hideClose
      title={
        <span className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              danger ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
            )}
          >
            {danger ? <AlertTriangle className="size-5" /> : <HelpCircle className="size-5" />}
          </span>
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm leading-relaxed text-ink-2">{description}</p>}
    </Modal>
  )
}

/** Provider que habilita `useConfirm()` em qualquer tela */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <ConfirmationDialog open {...options} onConfirm={() => close(true)} onCancel={() => close(false)} />}
    </ConfirmContext.Provider>
  )
}
