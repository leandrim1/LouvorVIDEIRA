import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CopyPlus, Info, Lock, Plus, Save } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useEvents, useMembers, useRepertoire, useSongUsage, useSongs } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useForm } from '@/hooks/useForm'
import { useMutation } from '@/hooks/useMutation'
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/lib/constants'
import { addDaysISO, formatDateShort, nextSunday, toISODate } from '@/lib/dates'
import { minLength, required, time } from '@/lib/validation'
import { repertoireService } from '@/services'
import type { Member, RepertoireDetail, RepertoireInput, Song, SongUsage } from '@/types'
import {
  BackLink,
  Button,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  EmptyState,
  Field,
  Input,
  LoadingState,
  SegmentedControl,
  Select,
  Textarea,
} from '@/components/ui'
import { RepertoireSongsEditor } from '@/components/repertoires/RepertoireSongsEditor'
import { SongPicker } from '@/components/repertoires/SongPicker'

const EMPTY: RepertoireInput = {
  name: 'Culto de Celebração',
  date: toISODate(nextSunday()),
  startTime: '19:00',
  eventType: 'service',
  location: 'Templo principal — Igreja Videira',
  description: '',
  notes: '',
  status: 'draft',
  eventId: null,
  songs: [],
}

function fromDetail(r: RepertoireDetail, mode: 'edit' | 'duplicate'): RepertoireInput {
  return {
    name: r.name,
    date: mode === 'duplicate' ? addDaysISO(r.event.date, 7) : r.event.date,
    startTime: r.event.startTime,
    eventType: r.event.type,
    location: r.event.location,
    description: r.description,
    notes: r.notes,
    status: mode === 'duplicate' ? 'draft' : r.status,
    eventId: mode === 'edit' ? r.eventId : null,
    songs: r.songs.map((s) => ({
      songId: s.songId,
      key: s.key,
      leadVocalId: s.leadVocalId,
      instrumentation: s.instrumentation,
      notes: s.notes,
    })),
  }
}

export default function RepertoireFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const duplicateId = params.get('duplicar')
  const eventId = params.get('evento')
  const mode: 'create' | 'edit' | 'duplicate' = id ? 'edit' : duplicateId ? 'duplicate' : 'create'
  const title = mode === 'edit' ? 'Editar repertório' : mode === 'duplicate' ? 'Duplicar repertório' : 'Novo repertório'
  useDocumentTitle(title)

  const { can } = useSession()
  const source = useRepertoire(id ?? duplicateId ?? undefined)
  const events = useEvents()
  const songs = useSongs()
  const members = useMembers()
  const usage = useSongUsage()

  const ready = songs.data && members.data && (!(id || duplicateId) || source.data) && (!eventId || events.data)

  if (!can('repertoires:write')) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Acesso restrito"
        description="Apenas líderes e administradores podem criar ou editar repertórios."
        className="mt-10"
      />
    )
  }
  if (source.error) {
    return <EmptyState icon={<Info />} title="Repertório não encontrado" description={source.error.message} className="mt-10" />
  }
  if (!ready) return <LoadingState label="Preparando formulário…" />

  let initial: RepertoireInput = { ...EMPTY }
  if (source.data) initial = fromDetail(source.data, mode === 'edit' ? 'edit' : 'duplicate')
  else if (eventId) {
    const event = events.data?.find((e) => e.id === eventId)
    if (event) {
      initial = {
        ...EMPTY,
        name: event.title,
        date: event.date,
        startTime: event.startTime,
        eventType: event.type,
        location: event.location,
        description: event.description,
        eventId: event.id,
      }
    }
  }

  return (
    <RepertoireForm
      key={`${mode}-${id ?? duplicateId ?? eventId ?? 'new'}`}
      mode={mode}
      title={title}
      initial={initial}
      repertoireId={id}
      source={source.data ?? null}
      songs={songs.data!}
      vocalists={members.data!.filter((m) => m.active && (m.roles.includes('vocal') || m.roles.includes('leader') || m.roles.includes('backing_vocal')))}
      usage={usage.data}
    />
  )
}

interface RepertoireFormProps {
  mode: 'create' | 'edit' | 'duplicate'
  title: string
  initial: RepertoireInput
  repertoireId?: string
  source: RepertoireDetail | null
  songs: Song[]
  vocalists: Member[]
  usage: Record<string, SongUsage> | undefined
}

function RepertoireForm({ mode, title, initial, repertoireId, source, songs, vocalists, usage }: RepertoireFormProps) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { user } = useSession()
  const [pickerOpen, setPickerOpen] = useState(false)
  const submitted = useRef(false)

  const form = useForm<RepertoireInput>(initial, (v) => ({
    name: required('Informe o nome do repertório')(v.name) ?? minLength(3)(v.name) ?? undefined,
    date: required('Informe a data')(v.date) ?? undefined,
    startTime: required('Informe o horário')(v.startTime) ?? time()(v.startTime) ?? undefined,
    songs: v.status === 'published' && v.songs.length === 0 ? 'Adicione ao menos uma música para publicar.' : undefined,
  }))
  const { values, set, errors } = form

  const save = useMutation(
    (input: RepertoireInput) =>
      mode === 'edit' && repertoireId ? repertoireService.update(repertoireId, input) : repertoireService.create(input, user?.id ?? null),
    {
      success: mode === 'edit' ? 'Repertório atualizado' : mode === 'duplicate' ? 'Repertório duplicado' : 'Repertório criado',
      error: 'Não foi possível salvar o repertório',
      onSuccess: (saved) => {
        submitted.current = true
        navigate(`/repertorios/${saved.id}`, { replace: true })
      },
    },
  )

  // Protege contra perda de alterações ao sair da página
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => form.isDirty && !submitted.current && currentLocation.pathname !== nextLocation.pathname,
  )
  const { state: blockerState, proceed, reset: stay } = blocker
  useEffect(() => {
    if (blockerState !== 'blocked') return
    void confirm({
      title: 'Descartar alterações?',
      description: 'Você tem alterações não salvas neste repertório.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Continuar editando',
      danger: true,
    }).then((ok) => (ok ? proceed?.() : stay?.()))
  }, [blockerState, proceed, stay, confirm])

  useEffect(() => {
    if (!form.isDirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form.isDirty])

  const selectedIds = useMemo(() => values.songs.map((s) => s.songId), [values.songs])
  const addSong = (song: Song) => {
    set('songs', [...values.songs, { songId: song.id, key: song.teamKey, leadVocalId: null, instrumentation: 'Banda completa', notes: '' }])
    form.setErrors((e) => ({ ...e, songs: undefined }))
  }

  const cancelTo = repertoireId ? `/repertorios/${repertoireId}` : '/repertorios'

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="animate-fade-in pb-24">
      <BackLink to={cancelTo} label={repertoireId ? 'Voltar ao repertório' : 'Repertórios'} />
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
      <p className="mb-6 text-sm text-ink-3">Preencha as informações do culto e monte a ordem das músicas.</p>

      {mode === 'duplicate' && source && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
          <CopyPlus className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            Baseado em <strong>{source.name}</strong> de {formatDateShort(source.event.date)}. A data foi ajustada para a semana seguinte —
            revise as músicas, os tons e salve.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Informações" description="Dados do culto ou evento" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do repertório" htmlFor="rep-name" required error={errors.name} className="sm:col-span-2">
                <Input id="rep-name" value={values.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Culto de Celebração" />
              </Field>
              <Field label="Data" htmlFor="rep-date" required error={errors.date}>
                <Input id="rep-date" type="date" value={values.date} invalid={!!errors.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="Horário" htmlFor="rep-time" required error={errors.startTime}>
                <Input id="rep-time" type="time" value={values.startTime} invalid={!!errors.startTime} onChange={(e) => set('startTime', e.target.value)} />
              </Field>
              <Field label="Tipo de evento" htmlFor="rep-type" required>
                <Select
                  id="rep-type"
                  value={values.eventType}
                  onChange={(e) => set('eventType', e.target.value as RepertoireInput['eventType'])}
                  options={EVENT_TYPES.filter((t) => t !== 'rehearsal').map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
                />
              </Field>
              <Field label="Local" htmlFor="rep-location">
                <Input id="rep-location" value={values.location} onChange={(e) => set('location', e.target.value)} />
              </Field>
              <Field label="Descrição" htmlFor="rep-desc" className="sm:col-span-2">
                <Textarea id="rep-desc" value={values.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Tema, ministração, momento especial…" />
              </Field>
              <Field label="Observações para a equipe" htmlFor="rep-notes" className="sm:col-span-2">
                <Textarea id="rep-notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Horário de chegada, vestimenta, avisos…" />
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[13px] font-semibold text-ink">Status</p>
                <SegmentedControl
                  label="Status do repertório"
                  value={values.status}
                  onChange={(v) => set('status', v)}
                  options={[
                    { value: 'draft', label: 'Rascunho' },
                    { value: 'published', label: 'Publicado' },
                  ]}
                />
                <p className="mt-1.5 text-xs text-ink-3">Repertórios publicados notificam a equipe.</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Músicas (${values.songs.length})`}
              description="Arraste para reorganizar · ajuste o tom de cada música"
              action={
                <Button size="sm" variant="soft" leftIcon={<Plus />} onClick={() => setPickerOpen(true)} className="lg:hidden">
                  Adicionar
                </Button>
              }
            />
            <CardBody>
              {errors.songs && (
                <p role="alert" aria-invalid="true" tabIndex={-1} className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {errors.songs}
                </p>
              )}
              <RepertoireSongsEditor items={values.songs} onChange={(items) => set('songs', items)} songs={songs} vocalists={vocalists} />
              <Button variant="secondary" leftIcon={<Plus />} onClick={() => setPickerOpen(true)} className="mt-3 w-full lg:hidden">
                Adicionar música
              </Button>
            </CardBody>
          </Card>
        </div>

        <aside className="hidden lg:col-span-2 lg:block">
          <Card className="sticky top-24">
            <CardHeader title="Adicionar músicas" description="Pesquise na biblioteca" />
            <CardBody>
              <SongPicker songs={songs} selectedIds={selectedIds} onAdd={addSong} usage={usage} />
            </CardBody>
          </Card>
        </aside>
      </div>

      <Drawer open={pickerOpen} onClose={() => setPickerOpen(false)} title="Adicionar músicas" description={`${values.songs.length} selecionada(s)`}>
        <SongPicker songs={songs} selectedIds={selectedIds} onAdd={addSong} usage={usage} />
      </Drawer>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/90 backdrop-blur-xl lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {form.isDirty && <span className="mr-auto hidden text-xs font-medium text-ink-3 sm:block">Alterações não salvas</span>}
          <Button variant="secondary" onClick={() => navigate(cancelTo)}>
            Cancelar
          </Button>
          <Button type="submit" leftIcon={<Save />} loading={save.isPending}>
            {mode === 'edit' ? 'Salvar alterações' : 'Salvar repertório'}
          </Button>
        </div>
      </div>
    </form>
  )
}
