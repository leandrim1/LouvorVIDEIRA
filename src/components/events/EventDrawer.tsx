import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ClipboardList, Clock, ListMusic, ListPlus, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useRepertoire } from '@/hooks/useData'
import { useMutation } from '@/hooks/useMutation'
import { formatDateWithWeekday, formatTimeRange } from '@/lib/dates'
import { eventService } from '@/services'
import type { EventDetail } from '@/types'
import { Button, ButtonLink, Drawer, KeyBadge, Skeleton } from '@/components/ui'
import { ScheduleRoster } from '@/components/schedules/ScheduleRoster'
import { EventTypeBadge } from './EventBits'
import { EventForm } from './EventForm'

interface EventDrawerProps {
  event: EventDetail | null
  onClose: () => void
}

/** Detalhe do evento no calendário: repertório + escala + ações */
export function EventDrawer({ event, onClose }: EventDrawerProps) {
  const { can, member } = useSession()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const { data: repertoire, isLoading } = useRepertoire(event?.repertoire?.id)

  const remove = useMutation((id: string) => eventService.remove(id), {
    success: 'Evento excluído',
    onSuccess: onClose,
  })

  if (!event) return null
  const isRehearsal = event.type === 'rehearsal'

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir evento?',
      description: isRehearsal
        ? 'O ensaio será removido do calendário.'
        : 'O evento, seu repertório e sua escala serão excluídos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (ok) void remove.mutate(event.id)
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="md"
        title={event.title}
        description={
          <div className="mt-1 space-y-2">
            <EventTypeBadge type={event.type} />
            <p className="flex items-center gap-1.5 text-sm text-ink-2">
              <CalendarClock className="size-4 text-ink-3" aria-hidden />
              {formatDateWithWeekday(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
            </p>
            {event.location && (
              <p className="flex items-center gap-1.5 text-sm text-ink-2">
                <MapPin className="size-4 text-ink-3" aria-hidden /> {event.location}
              </p>
            )}
          </div>
        }
        footer={
          can('events:write') ? (
            <>
              <Button variant="danger-ghost" size="sm" leftIcon={<Trash2 />} onClick={onDelete} loading={remove.isPending}>
                Excluir
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<Pencil />} onClick={() => setEditing(true)} className="ml-auto">
                Editar evento
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {event.description && <p className="text-sm leading-relaxed text-ink-2">{event.description}</p>}
          {event.rehearsal?.notes && (
            <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
              <span className="font-semibold text-ink">Observações: </span>
              {event.rehearsal.notes}
            </p>
          )}

          <section aria-labelledby="drawer-repertoire">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="drawer-repertoire" className="flex items-center gap-2 text-sm font-bold text-ink">
                <ListMusic className="size-4 text-ink-3" aria-hidden /> {isRehearsal ? 'Repertório a ensaiar' : 'Repertório'}
              </h3>
              {event.repertoire && (
                <ButtonLink to={`/repertorios/${event.repertoire.id}`} size="xs" variant="soft">
                  Abrir repertório
                </ButtonLink>
              )}
            </div>
            {!event.repertoire ? (
              <div className="rounded-2xl border border-dashed border-line-strong p-4 text-center">
                <p className="text-sm text-ink-3">Nenhum repertório vinculado.</p>
                {!isRehearsal && can('repertoires:write') && (
                  <Button size="sm" className="mt-3" leftIcon={<ListPlus />} onClick={() => navigate(`/repertorios/novo?evento=${event.id}`)}>
                    Criar repertório
                  </Button>
                )}
              </div>
            ) : isLoading || !repertoire ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {repertoire.songs.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/musicas/${item.song.id}?repertorio=${repertoire.id}`)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="tabular w-6 font-mono text-sm font-bold text-ink-3">{String(index + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{item.song.title}</span>
                      <KeyBadge value={item.key} size="sm" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {!isRehearsal && (
            <section aria-labelledby="drawer-schedule">
              <div className="mb-3 flex items-center justify-between">
                <h3 id="drawer-schedule" className="flex items-center gap-2 text-sm font-bold text-ink">
                  <ClipboardList className="size-4 text-ink-3" aria-hidden /> Escala
                </h3>
                {can('schedules:write') && (
                  <ButtonLink
                    to={event.schedule ? `/escalas/${event.schedule.id}/editar` : `/escalas/nova?evento=${event.id}`}
                    size="xs"
                    variant="soft"
                  >
                    {event.schedule ? 'Editar escala' : 'Montar escala'}
                  </ButtonLink>
                )}
              </div>
              {event.schedule ? (
                <div className="rounded-2xl border border-line px-4">
                  <ScheduleRoster schedule={event.schedule} variant="list" highlightMemberId={member?.id} />
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-sm text-ink-3">Escala ainda não definida.</p>
              )}
            </section>
          )}

          {isRehearsal && (
            <p className="flex items-center gap-2 text-xs text-ink-3">
              <Clock className="size-3.5" aria-hidden /> Gerencie os ensaios na página Ensaios.
            </p>
          )}
        </div>
      </Drawer>
      <EventForm open={editing} onClose={() => setEditing(false)} event={event} />
    </>
  )
}
