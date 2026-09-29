import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Eye, ImagePlus, Link2, Lock, Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { useSong } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useForm } from '@/hooks/useForm'
import { useMutation } from '@/hooks/useMutation'
import { LINK_TYPE_LABELS, TIME_SIGNATURES, TUNING_OPTIONS, VIDEO_TYPE_LABELS } from '@/lib/constants'
import { isValidKey, keyOptions, lyricsFromSheet, parseChordSheet } from '@/lib/music'
import { cn, isValidUrl, readImageAsDataUrl } from '@/lib/utils'
import { detectLinkType, parseVideoUrl } from '@/lib/video'
import { songService } from '@/services'
import type { SongInput, SongLinkType, SongVideoType, SongWithRelations } from '@/types'
import {
  BackLink,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingState,
  SegmentedControl,
  Select,
  Textarea,
} from '@/components/ui'
import { SheetView } from '@/components/songs/SongChords'
import { SongCover } from '@/components/songs/SongCover'
import { KeySelector } from '@/components/songs/KeySelector'

const EMPTY: SongInput = {
  title: '',
  artist: '',
  album: '',
  composer: '',
  originalKey: 'G',
  teamKey: 'G',
  bpm: null,
  capo: null,
  tuning: TUNING_OPTIONS[0],
  timeSignature: '4/4',
  lyrics: '',
  chords: '',
  notes: '',
  coverUrl: null,
  tags: [],
  videos: [],
  links: [],
}

const CHORDS_PLACEHOLDER = `[Intro]
G  D  Em  C

[Verso]
G              D
Grande é o Senhor
Em             C
Digno de todo louvor`

function toInput(song: SongWithRelations): SongInput {
  const { id: _id, createdAt: _c, updatedAt: _u, videos, links, ...rest } = song
  return {
    ...rest,
    videos: videos.map(({ id, type, title, url }) => ({ id, type, title, url })),
    links: links.map(({ id, type, label, url }) => ({ id, type, label, url })),
  }
}

type Errors = Partial<Record<keyof SongInput | `video-${number}` | `link-${number}`, string>>

function validate(v: SongInput): Errors {
  const errors: Errors = {}
  if (!v.title.trim()) errors.title = 'Informe o nome da música'
  if (!v.artist.trim()) errors.artist = 'Informe o artista'
  if (!isValidKey(v.originalKey)) errors.originalKey = 'Tom inválido'
  if (!isValidKey(v.teamKey)) errors.teamKey = 'Tom inválido'
  if (v.bpm !== null && (v.bpm < 30 || v.bpm > 300)) errors.bpm = 'BPM entre 30 e 300'
  if (v.capo !== null && (v.capo < 0 || v.capo > 12)) errors.capo = 'Capotraste entre 0 e 12'
  if (v.coverUrl && !v.coverUrl.startsWith('data:') && !isValidUrl(v.coverUrl)) errors.coverUrl = 'URL de imagem inválida'
  v.videos.forEach((video, i) => {
    if (!isValidUrl(video.url.trim())) errors[`video-${i}`] = 'Informe um link válido (https://…)'
  })
  v.links.forEach((link, i) => {
    if (!isValidUrl(link.url.trim())) errors[`link-${i}`] = 'Informe um link válido (https://…)'
  })
  return errors
}

export default function SongFormPage() {
  const { id } = useParams()
  const { can } = useSession()
  const { data: song, isLoading, error } = useSong(id)
  useDocumentTitle(id ? 'Editar música' : 'Nova música')

  if (!can('songs:write')) {
    return <EmptyState icon={<Lock />} title="Acesso restrito" description="Apenas líderes e administradores podem cadastrar músicas." className="mt-10" />
  }
  if (id && error) return <EmptyState icon={<Lock />} title="Música não encontrada" description={error.message} className="mt-10" />
  if (id && (isLoading || !song)) return <LoadingState label="Carregando música…" />
  return <SongForm key={id ?? 'new'} song={song ?? null} />
}

function SongForm({ song }: { song: SongWithRelations | null }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const submitted = useRef(false)
  const [chordsView, setChordsView] = useState<'edit' | 'preview'>('edit')
  const [tagsText, setTagsText] = useState(song?.tags.join(', ') ?? '')
  const form = useForm<SongInput>(song ? toInput(song) : EMPTY, validate as (v: SongInput) => Partial<Record<keyof SongInput, string>>)
  const { values, set, setValues } = form
  const errors = form.errors as Errors

  const save = useMutation((input: SongInput) => (song ? songService.update(song.id, input) : songService.create(input)), {
    success: song ? 'Música atualizada' : 'Música cadastrada',
    error: 'Não foi possível salvar a música',
    onSuccess: (saved) => {
      submitted.current = true
      navigate(`/musicas/${saved.id}`, { replace: true })
    },
  })

  const blocker = useBlocker(({ currentLocation, nextLocation }) => form.isDirty && !submitted.current && currentLocation.pathname !== nextLocation.pathname)
  const { state: blockerState, proceed, reset: stay } = blocker
  useEffect(() => {
    if (blockerState !== 'blocked') return
    void confirm({
      title: 'Descartar alterações?',
      description: 'As informações desta música ainda não foram salvas.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Continuar editando',
      danger: true,
    }).then((ok) => (ok ? proceed?.() : stay?.()))
  }, [blockerState, proceed, stay, confirm])

  const previewLines = useMemo(() => parseChordSheet(values.chords), [values.chords])
  const keys = keyOptions()

  const onCover = async (file: File | undefined) => {
    if (!file) return
    try {
      set('coverUrl', await readImageAsDataUrl(file, 480))
    } catch (err) {
      toast.error('Imagem inválida', err instanceof Error ? err.message : undefined)
    }
  }

  const clearError = (key: string) =>
    form.setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev } as Record<string, string | undefined>
      delete next[key]
      return next as typeof prev
    })
  const updateVideo = (index: number, patch: Partial<SongInput['videos'][number]>) => {
    setValues((v) => ({ ...v, videos: v.videos.map((item, i) => (i === index ? { ...item, ...patch } : item)) }))
    clearError(`video-${index}`)
  }
  const updateLink = (index: number, patch: Partial<SongInput['links'][number]>) => {
    setValues((v) => ({ ...v, links: v.links.map((item, i) => (i === index ? { ...item, ...patch } : item)) }))
    clearError(`link-${index}`)
  }

  const submit = form.handleSubmit((v) =>
    save.mutate({
      ...v,
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }),
  )

  return (
    <form noValidate onSubmit={submit} className="animate-fade-in pb-24">
      <BackLink to={song ? `/musicas/${song.id}` : '/musicas'} label={song ? 'Voltar para a música' : 'Músicas'} />
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{song ? 'Editar música' : 'Nova música'}</h1>
      <p className="mb-6 text-sm text-ink-3">Cadastre tons, cifra, letra, vídeos e links para a equipe estudar.</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Informações básicas */}
          <Card>
            <CardHeader title="Informações básicas" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da música" htmlFor="s-title" required error={errors.title} className="sm:col-span-2">
                <Input id="s-title" value={values.title} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Grande é o Senhor" />
              </Field>
              <Field label="Artista" htmlFor="s-artist" required error={errors.artist}>
                <Input id="s-artist" value={values.artist} invalid={!!errors.artist} onChange={(e) => set('artist', e.target.value)} />
              </Field>
              <Field label="Álbum" htmlFor="s-album">
                <Input id="s-album" value={values.album} onChange={(e) => set('album', e.target.value)} />
              </Field>
              <Field label="Compositor" htmlFor="s-composer">
                <Input id="s-composer" value={values.composer} onChange={(e) => set('composer', e.target.value)} />
              </Field>
              <Field label="Temas / tags" htmlFor="s-tags" hint="Separe por vírgula: adoração, celebração">
                <Input id="s-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              </Field>
            </CardBody>
          </Card>

          {/* Tonalidade */}
          <Card>
            <CardHeader title="Tonalidade e execução" description="A cifra deve ser escrita no tom original" />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tom original" htmlFor="s-okey" required error={errors.originalKey}>
                  <Select id="s-okey" value={values.originalKey} invalid={!!errors.originalKey} onChange={(e) => set('originalKey', e.target.value)} options={keys.map((k) => ({ value: k, label: k }))} />
                </Field>
                <div className="space-y-1.5">
                  <p className="text-[13px] font-semibold text-ink">
                    Tom utilizado pela equipe <span className="text-red-500">*</span>
                  </p>
                  <KeySelector value={values.teamKey} onChange={(k) => set('teamKey', k)} referenceKey={values.originalKey} label="Tom da equipe" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="BPM" htmlFor="s-bpm" error={errors.bpm}>
                  <Input
                    id="s-bpm"
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={300}
                    value={values.bpm ?? ''}
                    invalid={!!errors.bpm}
                    onChange={(e) => set('bpm', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </Field>
                <Field label="Capotraste" htmlFor="s-capo" error={errors.capo}>
                  <Select
                    id="s-capo"
                    value={values.capo === null ? '' : String(values.capo)}
                    onChange={(e) => set('capo', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="Sem capo"
                    options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}ª casa` }))}
                  />
                </Field>
                <Field label="Compasso" htmlFor="s-time">
                  <Select id="s-time" value={values.timeSignature} onChange={(e) => set('timeSignature', e.target.value)} options={TIME_SIGNATURES.map((t) => ({ value: t, label: t }))} />
                </Field>
                <Field label="Afinação" htmlFor="s-tuning">
                  <Select
                    id="s-tuning"
                    value={values.tuning}
                    onChange={(e) => set('tuning', e.target.value)}
                    options={[...new Set([...TUNING_OPTIONS, values.tuning])].filter(Boolean).map((t) => ({ value: t, label: t }))}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* Cifra */}
          <Card>
            <CardHeader
              title="Cifra"
              description="Acordes acima da letra (padrão Cifra Club) ou [G]inline"
              action={
                <SegmentedControl
                  size="sm"
                  label="Modo da cifra"
                  value={chordsView}
                  onChange={setChordsView}
                  options={[
                    { value: 'edit', label: 'Editar' },
                    { value: 'preview', label: 'Prévia', icon: <Eye /> },
                  ]}
                />
              }
            />
            <CardBody>
              {chordsView === 'edit' ? (
                <Textarea
                  aria-label="Cifra"
                  value={values.chords}
                  onChange={(e) => set('chords', e.target.value)}
                  rows={16}
                  spellCheck={false}
                  placeholder={CHORDS_PLACEHOLDER}
                  className="font-mono text-[13px] leading-relaxed sm:text-[13px]"
                />
              ) : values.chords.trim() ? (
                <div className="scrollbar-thin max-h-[480px] overflow-auto rounded-xl bg-surface-2/50 p-4">
                  <SheetView lines={previewLines} fontSize={14} />
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-ink-3">Escreva a cifra para ver a prévia.</p>
              )}
            </CardBody>
          </Card>

          {/* Letra */}
          <Card>
            <CardHeader
              title="Letra"
              action={
                <Button
                  size="xs"
                  variant="soft"
                  leftIcon={<Wand2 />}
                  disabled={!values.chords.trim()}
                  onClick={() => set('lyrics', lyricsFromSheet(values.chords))}
                >
                  Gerar a partir da cifra
                </Button>
              }
            />
            <CardBody>
              <Textarea
                aria-label="Letra"
                value={values.lyrics}
                onChange={(e) => set('lyrics', e.target.value)}
                rows={10}
                placeholder="Use [Verso], [Refrão] para marcar as partes."
              />
            </CardBody>
          </Card>

          {/* Vídeos */}
          <Card>
            <CardHeader
              title="Vídeos"
              description="YouTube e Vimeo geram o player automaticamente"
              action={
                <Button size="xs" variant="soft" leftIcon={<Plus />} onClick={() => set('videos', [...values.videos, { type: 'official', title: '', url: '' }])}>
                  Adicionar
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {values.videos.length === 0 && <p className="text-sm text-ink-3">Nenhum vídeo. Adicione o oficial, o de estudo e o do ensaio.</p>}
              {values.videos.map((video, i) => {
                const parsed = isValidUrl(video.url.trim()) ? parseVideoUrl(video.url) : null
                return (
                  <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[150px_1fr_auto]">
                    <Select
                      aria-label="Tipo do vídeo"
                      value={video.type}
                      onChange={(e) => updateVideo(i, { type: e.target.value as SongVideoType })}
                      options={Object.entries(VIDEO_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                    <div className="space-y-2">
                      <Input
                        aria-label="Link do vídeo"
                        type="url"
                        value={video.url}
                        invalid={!!errors[`video-${i}`]}
                        onChange={(e) => updateVideo(i, { url: e.target.value })}
                        placeholder="https://youtu.be/…"
                      />
                      <Input aria-label="Título do vídeo" value={video.title} onChange={(e) => updateVideo(i, { title: e.target.value })} placeholder="Título (opcional)" />
                      {errors[`video-${i}`] ? (
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors[`video-${i}`]}</p>
                      ) : parsed ? (
                        <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {parsed.provider === 'other' ? <Link2 className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                          {parsed.provider === 'youtube' ? 'YouTube detectado — player incorporado' : parsed.provider === 'vimeo' ? 'Vimeo detectado — player incorporado' : 'Link externo'}
                        </p>
                      ) : null}
                    </div>
                    <IconButton label="Remover vídeo" variant="danger-ghost" onClick={() => set('videos', values.videos.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                )
              })}
            </CardBody>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader
              title="Links externos"
              description="Spotify, Apple Music, Cifra Club, YouTube…"
              action={
                <Button size="xs" variant="soft" leftIcon={<Plus />} onClick={() => set('links', [...values.links, { type: 'spotify', label: '', url: '' }])}>
                  Adicionar
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {values.links.length === 0 && <p className="text-sm text-ink-3">Nenhum link cadastrado.</p>}
              {values.links.map((link, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[150px_1fr_auto]">
                  <Select
                    aria-label="Tipo do link"
                    value={link.type}
                    onChange={(e) => updateLink(i, { type: e.target.value as SongLinkType })}
                    options={Object.entries(LINK_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                  <div className="space-y-2">
                    <Input
                      aria-label="URL do link"
                      type="url"
                      value={link.url}
                      invalid={!!errors[`link-${i}`]}
                      onChange={(e) => {
                        const url = e.target.value
                        const detected = detectLinkType(url)
                        updateLink(i, { url, ...(detected !== 'other' ? { type: detected } : {}) })
                      }}
                      placeholder="https://open.spotify.com/…"
                    />
                    {errors[`link-${i}`] && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors[`link-${i}`]}</p>}
                  </div>
                  <IconButton label="Remover link" variant="danger-ghost" onClick={() => set('links', values.links.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </IconButton>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Capa" description="Imagem da música (opcional)" />
            <CardBody className="space-y-3">
              <SongCover title={values.title || 'Nova música'} src={values.coverUrl} size="fill" className="max-w-56" />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" leftIcon={<ImagePlus />} onClick={() => fileRef.current?.click()}>
                  Enviar imagem
                </Button>
                {values.coverUrl && (
                  <Button variant="danger-ghost" size="sm" leftIcon={<Trash2 />} onClick={() => set('coverUrl', null)}>
                    Remover
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onCover(e.target.files?.[0])} />
              <Field label="ou URL da imagem" htmlFor="s-cover" error={errors.coverUrl}>
                <Input
                  id="s-cover"
                  type="url"
                  value={values.coverUrl?.startsWith('data:') ? '' : (values.coverUrl ?? '')}
                  invalid={!!errors.coverUrl}
                  onChange={(e) => set('coverUrl', e.target.value.trim() || null)}
                  placeholder="https://…"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Observações" description="Arranjo, dinâmica, entradas" />
            <CardBody>
              <Textarea aria-label="Observações" value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={5} placeholder="Ex.: banda entra no segundo refrão." />
            </CardBody>
          </Card>

          <div className={cn('rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-3')}>
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <Sparkles className="size-4 text-brand-500" aria-hidden /> Dica
            </p>
            <p className="mt-1">
              Escreva a cifra no <strong>tom original</strong>. O sistema transpõe automaticamente para o tom da equipe e para o tom de cada repertório.
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/90 backdrop-blur-xl lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {Object.keys(errors).length > 0 && (
            <span className="mr-auto text-xs font-semibold text-red-600 dark:text-red-400">Revise os campos destacados</span>
          )}
          <Button variant="secondary" onClick={() => navigate(song ? `/musicas/${song.id}` : '/musicas')}>
            Cancelar
          </Button>
          <Button type="submit" leftIcon={<Save />} loading={save.isPending}>
            {song ? 'Salvar alterações' : 'Cadastrar música'}
          </Button>
        </div>
      </div>
    </form>
  )
}
