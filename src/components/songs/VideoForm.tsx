import { useEffect } from 'react'
import { CheckCircle2, Link2 } from 'lucide-react'
import { VIDEO_TYPE_LABELS } from '@/lib/constants'
import { required, url } from '@/lib/validation'
import { parseVideoUrl } from '@/lib/video'
import { useForm } from '@/hooks/useForm'
import { useMutation } from '@/hooks/useMutation'
import { songService } from '@/services'
import type { SongVideoInput, SongVideoType } from '@/types'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { SongPlayer } from './SongPlayer'

interface VideoFormProps {
  open: boolean
  onClose: () => void
  songId: string
}

const EMPTY: SongVideoInput = { type: 'study', title: '', url: '' }

/** Adiciona um vídeo (YouTube, Vimeo ou link externo) com pré-visualização */
export function VideoForm({ open, onClose, songId }: VideoFormProps) {
  const form = useForm<SongVideoInput>(EMPTY, { url: [required('Cole o link do vídeo'), url()] })
  const { values, set, errors, reset } = form
  useEffect(() => {
    if (open) reset(EMPTY)
  }, [open, reset])

  const parsed = values.url.trim() && !url()(values.url) ? parseVideoUrl(values.url) : null
  const save = useMutation(
    (v: SongVideoInput) => songService.addVideo(songId, { ...v, title: v.title.trim() || VIDEO_TYPE_LABELS[v.type] }),
    { success: 'Vídeo adicionado', onSuccess: onClose },
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Adicionar vídeo"
      description="Links do YouTube e Vimeo viram player automaticamente."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="video-form" loading={save.isPending}>
            Adicionar
          </Button>
        </>
      }
    >
      <form id="video-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
        <Field
          label="Link do vídeo"
          htmlFor="v-url"
          required
          error={errors.url}
          hint={
            parsed ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                {parsed.provider === 'other' ? <Link2 className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                {parsed.provider === 'youtube' ? 'YouTube detectado' : parsed.provider === 'vimeo' ? 'Vimeo detectado' : 'Link externo'}
              </span>
            ) : (
              'YouTube, Vimeo ou qualquer link externo'
            )
          }
        >
          <Input id="v-url" type="url" inputMode="url" value={values.url} invalid={!!errors.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" data-autofocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="v-type">
            <Select
              id="v-type"
              value={values.type}
              onChange={(e) => set('type', e.target.value as SongVideoType)}
              options={Object.entries(VIDEO_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Título" htmlFor="v-title" hint="Opcional">
            <Input id="v-title" value={values.title} onChange={(e) => set('title', e.target.value)} placeholder={VIDEO_TYPE_LABELS[values.type]} />
          </Field>
        </div>
        {parsed && parsed.provider !== 'other' && <SongPlayer url={values.url} title={values.title || VIDEO_TYPE_LABELS[values.type]} />}
      </form>
    </Modal>
  )
}
