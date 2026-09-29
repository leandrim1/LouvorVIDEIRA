import { useNavigate, useParams } from 'react-router-dom'
import { Clock, Copy, ListMusic, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { useEvents, useSchedule } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { MEMBER_ROLE_LABELS } from '@/lib/constants'
import { formatDateShort, formatDateWithWeekday, formatTimeRange } from '@/lib/dates'
import { copyToClipboard } from '@/lib/share'
import { pluralize, uniqueBy } from '@/lib/utils'
import { groupScheduleByRole, scheduleService } from '@/services'
import { BackLink, Button, ButtonLink, ErrorState, KeyBadge, Skeleton } from '@/components/ui'
import { EventTypeBadge } from '@/components/events/EventBits'
import { ScheduleRoster } from '@/components/schedules/ScheduleRoster'
import { useRepertoire } from '@/hooks/useData'

export default function ScheduleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { can, member } = useSession()
  const { data: schedule, isLoading, error, refetch } = useSchedule(id)
  const { data: events } = useEvents()
  const eventDetail = events?.find((e) => e.id === schedule?.eventId)
  const { data: repertoire } = useRepertoire(eventDetail?.repertoire?.id)
  useDocumentTitle(schedule ? `Escala · ${schedule.event.title} ${formatDateShort(schedule.event.date)}` : 'Escala')

  const remove = useMutation(() => scheduleService.remove(id!), {
    success: 'Escala excluída',
    onSuccess: () => navigate('/escalas', { replace: true }),
  })

  if (error) {
    return (
      <div>
        <BackLink to="/escalas" label="Escalas" />
        <ErrorState title="Escala não encontrada" error={error} onRetry={refetch} />
      </div>
    )
  }
  if (isLoading || !schedule) {
    return (
      <div role="status" aria-label="Carregando escala">
        <Skeleton className="mb-4 h-5 w-24" />
        <Skeleton className="mb-6 h-36 w-full rounded-3xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const { event } = schedule
  const people = uniqueBy(schedule.members, (m) => m.memberId).length

  const copy = async () => {
    const lines = [
      `*ESCALA — ${event.title.toUpperCase()}*`,
      `${formatDateWithWeekday(event.date)} · ${formatTimeRange(event.startTime, event.endTime)}`,
      '',
      ...groupScheduleByRole(schedule).map(({ role, members }) => `${MEMBER_ROLE_LABELS[role]}: ${members.map((m) => m.name).join(', ')}`),
      schedule.notes ? `\n📝 ${schedule.notes}` : '',
    ]
    const ok = await copyToClipboard(lines.join('\n').trim())
    if (ok) toast.success('Escala copiada', 'Cole no grupo da equipe.')
    else toast.error('Não foi possível copiar')
  }

  const onDelete = async () => {
    if (await confirm({ title: 'Excluir escala?', description: `A escala de ${formatDateShort(event.date)} será removida.`, confirmLabel: 'Excluir', danger: true })) {
      void remove.mutate()
    }
  }

  return (
    <div className="animate-fade-up">
      <BackLink to="/escalas" label="Escalas" />
      <section className="mb-6 rounded-3xl border border-line bg-surface p-5 shadow-xs sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <EventTypeBadge type={event.type} />
            <h1 className="mt-3 text-2xl font-extrabold tracking-wide text-ink uppercase sm:text-3xl">
              {event.title} — {formatDateShort(event.date)}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <span className="tabular inline-flex items-center gap-1.5">
                <Clock className="size-4 text-ink-3" aria-hidden /> {formatDateWithWeekday(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-ink-3" aria-hidden /> {event.location}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-ink-3">{pluralize(people, 'integrante')} escalados</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<Copy />} onClick={() => void copy()}>
              Copiar
            </Button>
            {can('schedules:write') && (
              <>
                <ButtonLink to={`/escalas/${schedule.id}/editar`} variant="secondary" leftIcon={<Pencil />}>
                  Editar
                </ButtonLink>
                <Button variant="danger-ghost" leftIcon={<Trash2 />} onClick={() => void onDelete()} loading={remove.isPending}>
                  Excluir
                </Button>
              </>
            )}
          </div>
        </div>
        {schedule.notes && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">{schedule.notes}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="roster-title">
          <h2 id="roster-title" className="mb-3 text-xs font-extrabold tracking-[0.14em] text-ink-3 uppercase">
            Escala
          </h2>
          <ScheduleRoster schedule={schedule} highlightMemberId={member?.id} className="xl:grid-cols-2" />
        </section>
        <aside>
          <h2 className="mb-3 text-xs font-extrabold tracking-[0.14em] text-ink-3 uppercase">Músicas</h2>
          {repertoire ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <ol className="divide-y divide-line">
                {repertoire.songs.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="tabular w-6 font-mono text-sm font-bold text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.song.title}</span>
                    <KeyBadge value={s.key} size="sm" />
                  </li>
                ))}
              </ol>
              <ButtonLink to={`/repertorios/${repertoire.id}`} variant="ghost" leftIcon={<ListMusic />} className="w-full rounded-none border-t border-line">
                Abrir repertório
              </ButtonLink>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-ink-3">
              Nenhum repertório vinculado a este evento.
              {can('repertoires:write') && (
                <ButtonLink to={`/repertorios/novo?evento=${event.id}`} size="sm" variant="soft" className="mt-3 flex">
                  Criar repertório
                </ButtonLink>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
