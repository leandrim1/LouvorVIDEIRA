import { Link } from 'react-router-dom'
import { Clock, MapPin, Music2 } from 'lucide-react'
import { formatDayMonth, formatTime, formatWeekday } from '@/lib/dates'
import { cn, pluralize } from '@/lib/utils'
import type { RepertoireSummary } from '@/types'
import { DateBlock, EventTypeBadge } from '@/components/events/EventBits'
import { RepertoireStatusBadge } from './RepertoireStatusBadge'

interface RepertoireCardProps {
  repertoire: RepertoireSummary
  className?: string
  compact?: boolean
}

export function RepertoireCard({ repertoire, className, compact }: RepertoireCardProps) {
  const { event } = repertoire
  return (
    <Link
      to={`/repertorios/${repertoire.id}`}
      className={cn(
        'group flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs transition-all hover:border-line-strong hover:shadow-md',
        className,
      )}
    >
      <DateBlock date={event.date} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-3">
          {formatDayMonth(event.date)} — {formatWeekday(event.date)}
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-base leading-snug font-bold text-ink group-hover:text-brand-700 sm:truncate dark:group-hover:text-brand-300">{repertoire.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
          <span className="tabular inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatTime(event.startTime)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Music2 className="size-3.5" aria-hidden /> {pluralize(repertoire.songCount, 'música')}
          </span>
          {!compact && event.location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>
        <div className="mt-2 sm:hidden">
          <RepertoireStatusBadge status={repertoire.status} event={event} />
        </div>
        {!compact && repertoire.songTitles.length > 0 && (
          <p className="mt-2 line-clamp-1 text-[13px] text-ink-2">{repertoire.songTitles.join(' · ')}</p>
        )}
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
        <RepertoireStatusBadge status={repertoire.status} event={event} />
        {!compact && <EventTypeBadge type={event.type} />}
      </div>
    </Link>
  )
}
