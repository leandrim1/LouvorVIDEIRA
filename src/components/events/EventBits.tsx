import { EVENT_TYPE_LABELS, EVENT_TYPE_STYLES } from '@/lib/constants'
import { formatDay, formatMonthShort, formatWeekdayShort, isToday } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { EventType } from '@/types'

/** Bloco de data estilo calendário:  DOM / 04 / OUT */
export function DateBlock({ date, size = 'md', className }: { date: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const today = isToday(date)
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-xl text-center ring-1 ring-inset',
        today ? 'bg-brand-600 text-white ring-brand-600 dark:bg-brand-600' : 'bg-surface-2 text-ink ring-line',
        size === 'sm' && 'size-11',
        size === 'md' && 'size-14',
        size === 'lg' && 'size-[72px]',
        className,
      )}
      aria-label={today ? 'Hoje' : undefined}
    >
      <span className={cn('text-[10px] font-bold tracking-wider uppercase', today ? 'text-white/80' : 'text-ink-3')}>
        {today ? 'Hoje' : formatWeekdayShort(date)}
      </span>
      <span className={cn('tabular leading-none font-extrabold', size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-base')}>
        {formatDay(date)}
      </span>
      {size !== 'sm' && <span className={cn('text-[10px] font-bold uppercase', today ? 'text-white/80' : 'text-ink-3')}>{formatMonthShort(date)}</span>}
    </div>
  )
}

export function EventTypeBadge({ type, className }: { type: EventType; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        EVENT_TYPE_STYLES[type].badge,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', EVENT_TYPE_STYLES[type].dot)} aria-hidden />
      {EVENT_TYPE_LABELS[type]}
    </span>
  )
}
