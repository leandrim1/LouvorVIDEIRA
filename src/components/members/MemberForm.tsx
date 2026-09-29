import { useEffect, useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { MEMBER_ROLES, MEMBER_ROLE_LABELS, VOICE_LABELS } from '@/lib/constants'
import { email, minLength, required, url } from '@/lib/validation'
import { cn, readImageAsDataUrl } from '@/lib/utils'
import { useForm } from '@/hooks/useForm'
import { useMutation } from '@/hooks/useMutation'
import { useToast } from '@/contexts/toast'
import { memberService } from '@/services'
import type { Member, MemberInput, VoiceType } from '@/types'
import { Avatar, Button, Field, Input, Modal, Select, Switch, Textarea } from '@/components/ui'

interface MemberFormProps {
  open: boolean
  onClose: () => void
  member?: Member | null
}

const toInput = (m?: Member | null): MemberInput => ({
  name: m?.name ?? '',
  photoUrl: m?.photoUrl ?? null,
  roles: m?.roles ?? [],
  instrument: m?.instrument ?? '',
  voice: m?.voice ?? 'none',
  phone: m?.phone ?? '',
  email: m?.email ?? '',
  notes: m?.notes ?? '',
  active: m?.active ?? true,
})

export function MemberForm({ open, onClose, member }: MemberFormProps) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const form = useForm<MemberInput>(toInput(member), (v) => ({
    name: required('Informe o nome')(v.name) ?? minLength(3)(v.name) ?? undefined,
    roles: v.roles.length === 0 ? 'Selecione ao menos uma função' : undefined,
    email: email()(v.email) ?? undefined,
    photoUrl: v.photoUrl && !v.photoUrl.startsWith('data:') ? (url()(v.photoUrl) ?? undefined) : undefined,
  }))
  const { values, set, errors, reset } = form

  useEffect(() => {
    if (open) reset(toInput(member))
  }, [open, member, reset])

  const save = useMutation((input: MemberInput) => (member ? memberService.update(member.id, input) : memberService.create(input)), {
    success: member ? 'Integrante atualizado' : 'Integrante cadastrado',
    error: 'Não foi possível salvar o integrante',
    onSuccess: onClose,
  })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      set('photoUrl', await readImageAsDataUrl(file, 320))
    } catch (err) {
      toast.error('Imagem inválida', err instanceof Error ? err.message : undefined)
    }
  }

  const toggleRole = (role: Member['roles'][number]) =>
    set('roles', values.roles.includes(role) ? values.roles.filter((r) => r !== role) : [...values.roles, role])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={member ? 'Editar integrante' : 'Novo integrante'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="member-form" loading={save.isPending}>
            {member ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form id="member-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={values.name || 'Novo integrante'} src={values.photoUrl} size="xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" leftIcon={<ImagePlus />} onClick={() => fileRef.current?.click()}>
                Enviar foto
              </Button>
              {values.photoUrl && (
                <Button variant="danger-ghost" size="sm" leftIcon={<Trash2 />} onClick={() => set('photoUrl', null)}>
                  Remover
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            <Input
              value={values.photoUrl && !values.photoUrl.startsWith('data:') ? values.photoUrl : ''}
              onChange={(e) => set('photoUrl', e.target.value || null)}
              placeholder="ou cole a URL de uma foto"
              aria-label="URL da foto"
              invalid={!!errors.photoUrl}
            />
            {errors.photoUrl && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors.photoUrl}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="m-name" required error={errors.name} className="sm:col-span-2">
            <Input id="m-name" value={values.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} data-autofocus />
          </Field>
          <Field label="Instrumento principal" htmlFor="m-instrument" hint="Ex.: Violão, Teclado, Mesa de som">
            <Input id="m-instrument" value={values.instrument} onChange={(e) => set('instrument', e.target.value)} />
          </Field>
          <Field label="Vocal" htmlFor="m-voice">
            <Select
              id="m-voice"
              value={values.voice}
              onChange={(e) => set('voice', e.target.value as VoiceType)}
              options={Object.entries(VOICE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-ink">
            Funções <span className="text-red-500">*</span>
          </legend>
          <div className="flex flex-wrap gap-2" role="group" aria-invalid={!!errors.roles || undefined}>
            {MEMBER_ROLES.map((role) => {
              const active = values.roles.includes(role)
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleRole(role)}
                  className={cn(
                    'h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors ring-inset',
                    active
                      ? 'bg-brand-600 text-white ring-brand-600 dark:bg-brand-500 dark:ring-brand-500'
                      : 'bg-surface text-ink-2 ring-line hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {MEMBER_ROLE_LABELS[role]}
                </button>
              )
            })}
          </div>
          {errors.roles && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.roles}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone / WhatsApp" htmlFor="m-phone">
            <Input id="m-phone" type="tel" inputMode="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-0000" />
          </Field>
          <Field label="E-mail" htmlFor="m-email" error={errors.email}>
            <Input id="m-email" type="email" value={values.email} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Observações" htmlFor="m-notes" className="sm:col-span-2">
            <Textarea id="m-notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </Field>
        </div>
        <Switch checked={values.active} onChange={(v) => set('active', v)} label="Integrante ativo" description="Inativos não aparecem para novas escalas." />
      </form>
    </Modal>
  )
}
