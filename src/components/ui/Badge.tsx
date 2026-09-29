import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  dot?: boolean
}

export function Badge({ tone = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset [&_svg]:size-3.5',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

interface KeyBadgeProps {
  value: string
  size?: 'sm' | 'md' | 'lg'
  label?: boolean
  className?: string
}

/** Destaque para tonalidade — informação mais consultada durante o culto */
export function KeyBadge({ value, size = 'md', label = true, className }: KeyBadgeProps) {
  const sizes = {
    sm: 'h-6 px-2 text-xs gap-1',
    md: 'h-7 px-2.5 text-[13px] gap-1.5',
    lg: 'h-10 px-3.5 text-base gap-2',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg bg-brand-600/[0.08] font-semibold whitespace-nowrap text-brand-700 ring-1 ring-inset ring-brand-600/15 dark:bg-leaf-400/10 dark:text-leaf-300 dark:ring-leaf-300/20',
        sizes[size],
        className,
      )}
      aria-label={`Tom ${value}`}
    >
      {label && <span className="font-medium opacity-70">Tom</span>}
      <span className="font-mono font-bold tracking-tight">{value}</span>
    </span>
  )
}
