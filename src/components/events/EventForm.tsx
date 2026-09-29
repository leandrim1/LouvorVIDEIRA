import { useEffect } from 'react'
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/lib/constants'
import { todayISO } from '@/lib/dates'
import { required, minLength, time } from '@/lib/validation'
import { useForm } from '@/hooks/useForm'
import { useMutation } from '@/hooks/useMutation'
import { eventService } from '@/services'
import type { ChurchEvent, EventInput } from '@/types'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'

interface EventFormProps {
  open: boolean
  onClose: () => void
  event?: ChurchEvent | null
  defaultDate?: string
  onSaved?: (event: ChurchEvent) => void
}

const toInput = (e: ChurchEvent): EventInput => ({
  title: e.title,
  type: e.type,
  date: e.date,
  startTime: e.startTime,
  endTime: e.endTime,
  location: e.location,
  description: e.description,
})

const empty = (date?: string): EventInput => ({
  title: '',
  type: 'service',
  date: date ?? todayISO(),
  startTime: '19:00',
  endTime: null,
  location: '',
  description: '',
})

export function EventForm({ open, onClose, event, defaultDate, onSaved }: EventFormProps) {
  const form = useForm<EventInput>(event ? toInput(event) : empty(defaultDate), {
    title: [required('Informe o nome do evento'), minLength(3)],
    date: [required('Informe a data')],
    startTime: [required('Informe o horário'), time()],
  })
  const { reset } = form

  useEffect(() => {
    if (open) reset(event ? toInput(event) : empty(defaultDate))
  }, [open, event, defaultDate, reset])

  const save = useMutation((input: EventInput) => (event ? eventService.update(event.id, input) : eventService.create(input)), {
    success: event ? 'Evento atualizado' : 'Evento criado',
    error: 'Não foi possível salvar o evento',
    onSuccess: (saved) => {
      onSaved?.(saved)
      onClose()
    },
  })

  const { values, set, errors } = form
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Editar evento' : 'Novo evento'}
      description="Cultos, ensaios, conferências, vigílias e outros encontros."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="event-form" loading={save.isPending}>
            {event ? 'Salvar alterações' : 'Criar evento'}
          </Button>
        </>
      }
    >
      <form id="event-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate({ ...v, endTime: v.endTime || null }))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do evento" htmlFor="ev-title" required error={errors.title} className="sm:col-span-2">
          <Input id="ev-title" value={values.title} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Culto de Celebração" data-autofocus />
        </Field>
        <Field label="Tipo de evento" htmlFor="ev-type" required>
          <Select
            id="ev-type"
            value={values.type}
            onChange={(e) => set('type', e.target.value as EventInput['type'])}
            options={EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
          />
        </Field>
        <Field label="Data" htmlFor="ev-date" required error={errors.date}>
          <Input id="ev-date" type="date" value={values.date} invalid={!!errors.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Início" htmlFor="ev-start" required error={errors.startTime}>
          <Input id="ev-start" type="time" value={values.startTime} invalid={!!errors.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </Field>
        <Field label="Término" htmlFor="ev-end" hint="Opcional">
          <Input id="ev-end" type="time" value={values.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || null)} />
        </Field>
        <Field label="Local" htmlFor="ev-location" className="sm:col-span-2">
          <Input id="ev-location" value={values.location} onChange={(e) => set('location', e.target.value)} placeholder="Ex.: Templo principal" />
        </Field>
        <Field label="Descrição" htmlFor="ev-desc" className="sm:col-span-2">
          <Textarea id="ev-desc" value={values.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </Field>
      </form>
    </Modal>
  )
}
