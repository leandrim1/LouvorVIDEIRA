import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Lock, Save, UserPlus, X } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useEvents, useMembers, useSchedule } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { EVENT_TYPE_LABELS, MEMBER_ROLES, MEMBER_ROLE_LABELS } from '@/lib/constants'
import { formatDateShort, formatTime, isUpcoming } from '@/lib/dates'
import { scheduleService } from '@/services'
import type { EventDetail, Member, MemberRole, ScheduleDetail, ScheduleInput } from '@/types'
import { Avatar, BackLink, Button, Card, CardBody, CardHeader, EmptyState, Field, LoadingState, Select, Textarea } from '@/components/ui'

export default function ScheduleFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { can } = useSession()
  const schedule = useSchedule(id)
  const events = useEvents()
  const members = useMembers()
  useDocumentTitle(id ? 'Editar escala' : 'Nova escala')

  if (!can('schedules:write')) {
    return <EmptyState icon={<Lock />} title="Acesso restrito" description="Apenas líderes e administradores podem montar escalas." className="mt-10" />
  }
  if (id && schedule.error) return <EmptyState icon={<Lock />} title="Escala não encontrada" className="mt-10" />
  if (!events.data || !members.data || (id && !schedule.data)) return <LoadingState label="Carregando…" />

  return (
    <ScheduleForm
      key={id ?? 'new'}
      schedule={schedule.data ?? null}
      events={events.data}
      members={members.data}
      defaultEventId={params.get('evento')}
    />
  )
}

interface ScheduleFormProps {
  schedule: ScheduleDetail | null
  events: EventDetail[]
  members: Member[]
  defaultEventId: string | null
}

function ScheduleForm({ schedule, events, members, defaultEventId }: ScheduleFormProps) {
  const navigate = useNavigate()
  const [eventId, setEventId] = useState(schedule?.eventId ?? defaultEventId ?? '')
  const [notes, setNotes] = useState(schedule?.notes ?? '')
  const [assignments, setAssignments] = useState<ScheduleInput['members']>(
    schedule?.members.map((m) => ({ memberId: m.memberId, role: m.role })) ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  // Eventos disponíveis: próximos (exceto ensaios) sem escala + o evento atual
  const availableEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.type !== 'rehearsal' &&
          (e.id === schedule?.eventId || e.id === defaultEventId || (!e.schedule && isUpcoming(e.date, e.startTime))),
      ),
    [events, schedule?.eventId, defaultEventId],
  )
  const activeMembers = members.filter((m) => m.active || assignments.some((a) => a.memberId === m.id))

  const save = useMutation((input: ScheduleInput) => scheduleService.save(input, schedule?.id), {
    success: schedule ? 'Escala atualizada' : 'Escala criada — integrantes notificados',
    error: 'Não foi possível salvar a escala',
    onSuccess: (saved) => navigate(`/escalas/${saved.id}`, { replace: true }),
  })

  const add = (role: MemberRole, memberId: string) => {
    if (!memberId || assignments.some((a) => a.role === role && a.memberId === memberId)) return
    setAssignments((list) => [...list, { role, memberId }])
    setError(null)
  }
  const remove = (role: MemberRole, memberId: string) =>
    setAssignments((list) => list.filter((a) => !(a.role === role && a.memberId === memberId)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!eventId) return setError('Selecione o evento da escala.')
    if (assignments.length === 0) return setError('Adicione ao menos um integrante.')
    void save.mutate({ eventId, notes, members: assignments })
  }

  const selectedEvent = events.find((e) => e.id === eventId)

  return (
    <form onSubmit={submit} noValidate className="animate-fade-in pb-24">
      <BackLink to={schedule ? `/escalas/${schedule.id}` : '/escalas'} label={schedule ? 'Voltar para a escala' : 'Escalas'} />
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{schedule ? 'Editar escala' : 'Nova escala'}</h1>
      <p className="mb-6 text-sm text-ink-3">Defina quem vai tocar e cantar. Os integrantes escalados recebem uma notificação.</p>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Evento" />
            <CardBody className="space-y-4">
              <Field label="Culto / evento" htmlFor="sch-event" required>
                <Select
                  id="sch-event"
                  value={eventId}
                  invalid={!!error && !eventId}
                  onChange={(e) => {
                    setEventId(e.target.value)
                    setError(null)
                  }}
                  placeholder="Selecione…"
                  options={availableEvents.map((e) => ({
                    value: e.id,
                    label: `${formatDateShort(e.date)} ${formatTime(e.startTime)} — ${e.title} (${EVENT_TYPE_LABELS[e.type]})`,
                  }))}
                />
              </Field>
              {availableEvents.length === 0 && <p className="text-sm text-ink-3">Todos os próximos eventos já possuem escala. Crie um evento no calendário.</p>}
              <Field label="Observações" htmlFor="sch-notes">
                <Textarea id="sch-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex.: todos às 17:30 para a passagem de som" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Funções" description="Adicione integrantes em cada função" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {MEMBER_ROLES.map((role) => {
                const assigned = assignments.filter((a) => a.role === role)
                const withRole = activeMembers.filter((m) => m.roles.includes(role) && !assigned.some((a) => a.memberId === m.id))
                const others = activeMembers.filter((m) => !m.roles.includes(role) && !assigned.some((a) => a.memberId === m.id))
                return (
                  <section key={role} className="rounded-2xl border border-line p-3" aria-label={MEMBER_ROLE_LABELS[role]}>
                    <h3 className="mb-2 flex items-center justify-between text-[13px] font-bold text-ink">
                      {MEMBER_ROLE_LABELS[role]}
                      {assigned.length > 0 && <span className="tabular text-xs font-semibold text-ink-3">{assigned.length}</span>}
                    </h3>
                    <ul className="mb-2 space-y-1.5">
                      {assigned.map((a) => {
                        const m = members.find((x) => x.id === a.memberId)
                        if (!m) return null
                        return (
                          <li key={a.memberId} className="flex items-center gap-2 rounded-xl bg-surface-2 p-1.5 pr-1">
                            <Avatar name={m.name} src={m.photoUrl} size="xs" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{m.name}</span>
                            <button
                              type="button"
                              onClick={() => remove(role, m.id)}
                              className="flex size-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-red-600"
                              aria-label={`Remover ${m.name} de ${MEMBER_ROLE_LABELS[role]}`}
                            >
                              <X className="size-4" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                    <label className="relative block">
                      <span className="sr-only">Adicionar em {MEMBER_ROLE_LABELS[role]}</span>
                      <UserPlus className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                      <Select value="" onChange={(e) => add(role, e.target.value)} className="h-10 pl-9 text-sm">
                        <option value="">Adicionar…</option>
                        {withRole.length > 0 && (
                          <optgroup label={`Com a função ${MEMBER_ROLE_LABELS[role]}`}>
                            {withRole.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Outros integrantes">
                            {others.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                    </label>
                  </section>
                )
              })}
            </CardBody>
          </Card>
        </div>

        <aside>
          <Card className="sticky top-24">
            <CardHeader title="Resumo" />
            <CardBody className="space-y-3 text-sm">
              {selectedEvent ? (
                <p className="font-semibold text-ink">
                  {selectedEvent.title}
                  <span className="block text-xs font-normal text-ink-3">
                    {formatDateShort(selectedEvent.date)} às {formatTime(selectedEvent.startTime)}
                  </span>
                </p>
              ) : (
                <p className="text-ink-3">Nenhum evento selecionado.</p>
              )}
              <dl className="divide-y divide-line">
                {MEMBER_ROLES.filter((r) => assignments.some((a) => a.role === r)).map((role) => (
                  <div key={role} className="flex justify-between gap-3 py-2">
                    <dt className="text-ink-3">{MEMBER_ROLE_LABELS[role]}</dt>
                    <dd className="text-right font-semibold text-ink">
                      {assignments
                        .filter((a) => a.role === role)
                        .map((a) => members.find((m) => m.id === a.memberId)?.name.split(' ')[0])
                        .join(', ')}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/90 backdrop-blur-xl lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Button variant="secondary" onClick={() => navigate(schedule ? `/escalas/${schedule.id}` : '/escalas')}>
            Cancelar
          </Button>
          <Button type="submit" leftIcon={<Save />} loading={save.isPending}>
            Salvar escala
          </Button>
        </div>
      </div>
    </form>
  )
}
