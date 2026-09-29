import type { ReactNode } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface EmptyStateProps {
  /** Nível do título (ex.: páginas inteiras vazias usam h1) */
  as?: 'p' | 'h1' | 'h2'
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({ as: Title = 'p', icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-2xl bg-surface-2 text-ink-3 ring-1 ring-line',
          compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
        )}
      >
        {icon}
      </span>
      <div className="max-w-sm">
        <Title className={cn('font-bold text-ink', compact ? 'text-sm' : 'text-base')}>{title}</Title>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-3 py-16 text-ink-3', className)}>
      <Loader2 className="size-6 animate-spin text-brand-500" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface-3)_50%,var(--surface-2)_100%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}

/** Lista de cards em carregamento */
export function SkeletonList({ count = 4, className, itemClassName }: { count?: number; className?: string; itemClassName?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={cn('space-y-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-4 rounded-2xl border border-line bg-surface p-4', itemClassName)}>
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  error?: Error | null
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title = 'Não foi possível carregar', error, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-6 py-12 text-center dark:border-red-500/20 dark:bg-red-500/5',
        className,
      )}
    >
      <AlertCircle className="size-8 text-red-500" aria-hidden />
      <div>
        <p className="font-bold text-ink">{title}</p>
        {error?.message && <p className="mt-1 text-sm text-ink-2">{error.message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw />}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
