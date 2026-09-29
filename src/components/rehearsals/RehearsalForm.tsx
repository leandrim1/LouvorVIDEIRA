import { useEffect, useMemo } from 'react'
import { formatDayMonth, todayISO } from '@/lib/dates'
import { required, time } from '@/lib/validation'
import { useForm } from '@/hooks/useForm'
import { useMutation } from '@/hooks/useMutation'
import { rehearsalService } from '@/services'
import type { RehearsalDetail, RehearsalInput, RepertoireSummary } from '@/types'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'

interface RehearsalFormProps {
  open: boolean
  onClose: () => void
  rehearsal?: RehearsalDetail | null
  repertoires: RepertoireSummary[]
  defaultRepertoireId?: string | null
}

const toInput = (r?: RehearsalDetail | null, repertoireId?: string | null): RehearsalInput => ({
  title: r?.event.title ?? 'Ensaio geral',
  date: r?.event.date ?? todayISO(),
  startTime: r?.event.startTime ?? '20:00',
  endTime: r?.event.endTime ?? '22:00',
  location: r?.event.location ?? 'Sala de música',
  notes: r?.notes ?? '',
  repertoireId: r ? r.repertoireId : (repertoireId ?? null),
})

export function RehearsalForm({ open, onClose, rehearsal, repertoires, defaultRepertoireId }: RehearsalFormProps) {
  const form = useForm<RehearsalInput>(toInput(rehearsal, defaultRepertoireId), {
    title: [required('Informe um título')],
    date: [required('Informe a data')],
    startTime: [required('Informe o horário'), time()],
  })
  const { values, set, errors, reset } = form

  useEffect(() => {
    if (open) reset(toInput(rehearsal, defaultRepertoireId))
  }, [open, rehearsal, defaultRepertoireId, reset])

  const options = useMemo(
    () =>
      [...repertoires]
        .sort((a, b) => b.event.date.localeCompare(a.event.date))
        .map((r) => ({ value: r.id, label: `${formatDayMonth(r.event.date)} — ${r.name} (${r.songCount} músicas)` })),
    [repertoires],
  )

  const save = useMutation(
    (input: RehearsalInput) => (rehearsal ? rehearsalService.update(rehearsal.id, input) : rehearsalService.create(input)),
    { success: rehearsal ? 'Ensaio atualizado' : 'Ensaio agendado', error: 'Não foi possível salvar o ensaio', onSuccess: onClose },
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rehearsal ? 'Editar ensaio' : 'Novo ensaio'}
      description="O ensaio aparece no calendário e notifica a equipe."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="rehearsal-form" loading={save.isPending}>
            {rehearsal ? 'Salvar' : 'Agendar ensaio'}
          </Button>
        </>
      }
    >
      <form id="rehearsal-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="r-title" required error={errors.title} className="sm:col-span-2">
          <Input id="r-title" value={values.title} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} data-autofocus />
        </Field>
        <Field label="Data" htmlFor="r-date" required error={errors.date}>
          <Input id="r-date" type="date" value={values.date} invalid={!!errors.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" htmlFor="r-start" required error={errors.startTime}>
            <Input id="r-start" type="time" value={values.startTime} invalid={!!errors.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </Field>
          <Field label="Término" htmlFor="r-end">
            <Input id="r-end" type="time" value={values.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || null)} />
          </Field>
        </div>
        <Field label="Local" htmlFor="r-location" className="sm:col-span-2">
          <Input id="r-location" value={values.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Repertório relacionado" htmlFor="r-repertoire" className="sm:col-span-2" hint="As músicas deste repertório serão ensaiadas.">
          <Select
            id="r-repertoire"
            value={values.repertoireId ?? ''}
            onChange={(e) => set('repertoireId', e.target.value || null)}
            placeholder="Nenhum"
            options={options}
          />
        </Field>
        <Field label="Observações" htmlFor="r-notes" className="sm:col-span-2">
          <Textarea id="r-notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Ex.: trazer in-ear, revisar transições" />
        </Field>
      </form>
    </Modal>
  )
}
