import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { cardClasses } from './styles'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardClasses, className)} {...props} />
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
  as?: 'h2' | 'h3'
}

export function CardHeader({ title, description, icon, action, className, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300 [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Heading className="truncate text-[15px] font-bold tracking-tight text-ink">{title}</Heading>
          {description && <p className="mt-0.5 truncate text-xs text-ink-3">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}
