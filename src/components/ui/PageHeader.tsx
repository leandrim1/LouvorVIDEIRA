import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  eyebrow?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, back, eyebrow, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-3 inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-ink-3 transition-colors hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-3 sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ title, action, className, id }: { title: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="text-[15px] font-bold tracking-tight text-ink">
        {title}
      </h2>
      {action}
    </div>
  )
}

export function BackLink({ to, label, className }: { to: string; label: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn('mb-4 inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-ink-3 transition-colors hover:text-ink', className)}
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
