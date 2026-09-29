import { Link } from 'react-router-dom'
import { Clock, ListMusic, MapPin, Music2, Pencil, Trash2 } from 'lucide-react'
import { formatDayMonth, formatTimeRange, isPast, relativeDayLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { RehearsalDetail } from '@/types'
import { Badge, IconButton } from '@/components/ui'
import { DateBlock } from '@/components/events/EventBits'

interface RehearsalCardProps {
  rehearsal: RehearsalDetail
  onEdit?: () => void
  onDelete?: () => void
}

/** ENSAIO · 04/10 · 18:00 · Repertório: Culto de Celebração · Músicas: 4 */
export function RehearsalCard({ rehearsal, onEdit, onDelete }: RehearsalCardProps) {
  const { event, repertoire } = rehearsal
  const past = isPast(event.date, event.startTime)
  const relative = relativeDayLabel(event.date)

  return (
    <article className={cn('rounded-2xl border border-line bg-surface p-4 shadow-xs', past && 'opacity-70')}>
      <div className="flex items-start gap-4">
        <DateBlock date={event.date} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold tracking-wider text-leaf-600 uppercase dark:text-leaf-300">Ensaio</p>
            {!past && (relative === 'Hoje' || relative === 'Amanhã') && <Badge tone="info">{relative}</Badge>}
            {past && <Badge>Realizado</Badge>}
          </div>
          <h3 className="mt-0.5 truncate text-base font-bold text-ink">{event.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-3">
            <span className="tabular inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {formatDayMonth(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
            </span>
            {event.location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="-mt-1 -mr-1 flex shrink-0">
            {onEdit && (
              <IconButton label="Editar ensaio" size="icon-sm" onClick={onEdit}>
                <Pencil />
              </IconButton>
            )}
            {onDelete && (
              <IconButton label="Excluir ensaio" size="icon-sm" variant="danger-ghost" onClick={onDelete}>
                <Trash2 />
              </IconButton>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-3">Repertório</p>
          {repertoire ? (
            <Link to={`/repertorios/${repertoire.id}`} className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-ink hover:text-brand-600 dark:hover:text-brand-300">
              <ListMusic className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span className="truncate">{repertoire.name}</span>
            </Link>
          ) : (
            <p className="mt-0.5 text-sm text-ink-3 italic">Não vinculado</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-ink-3">Músicas</p>
          <p className="tabular mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Music2 className="size-4 text-ink-3" aria-hidden /> {repertoire?.songCount ?? 0}
          </p>
        </div>
      </div>
      {repertoire && repertoire.songTitles.length > 0 && (
        <p className="mt-3 line-clamp-2 text-[13px] text-ink-2">{repertoire.songTitles.map((t, i) => `${i + 1}. ${t}`).join('  ')}</p>
      )}
      {rehearsal.notes && <p className="mt-2 text-[13px] text-ink-3">{rehearsal.notes}</p>}
    </article>
  )
}
