import { Link } from 'react-router-dom'
import { ChevronRight, Clock, ListMusic, MapPin } from 'lucide-react'
import { EVENT_TYPE_STYLES } from '@/lib/constants'
import { formatTimeRange, isPast } from '@/lib/dates'
import { cn, pluralize } from '@/lib/utils'
import type { EventDetail } from '@/types'
import { DateBlock, EventTypeBadge } from './EventBits'

interface EventCardProps {
  event: EventDetail
  onOpen?: (event: EventDetail) => void
  className?: string
}

/** Card de evento: Data | Horário | Evento | Repertório */
export function EventCard({ event, onOpen, className }: EventCardProps) {
  const past = isPast(event.date, event.startTime)
  const content = (
    <>
      <DateBlock date={event.date} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-bold text-ink">{event.title}</h3>
          <EventTypeBadge type={event.type} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-3">
          <span className="tabular inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatTimeRange(event.startTime, event.endTime)}
          </span>
          {event.location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium">
          <ListMusic className="size-3.5 text-ink-3" aria-hidden />
          {event.repertoire ? (
            <span className="text-ink-2">
              {event.type === 'rehearsal' ? `Repertório: ${event.repertoire.name}` : pluralize(event.repertoire.songCount, 'música')}
            </span>
          ) : (
            <span className="text-ink-3 italic">Sem repertório</span>
          )}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
    </>
  )

  const classes = cn(
    'flex w-full items-center gap-3.5 rounded-2xl border border-l-4 border-line bg-surface p-3.5 text-left shadow-xs transition-all hover:border-line-strong hover:shadow-md',
    EVENT_TYPE_STYLES[event.type].bar,
    past && 'opacity-70',
    className,
  )

  if (onOpen) {
    return (
      <button type="button" className={classes} onClick={() => onOpen(event)}>
        {content}
      </button>
    )
  }
  return (
    <Link to={event.repertoire ? `/repertorios/${event.repertoire.id}` : `/calendario?evento=${event.id}`} className={classes}>
      {content}
    </Link>
  )
}
