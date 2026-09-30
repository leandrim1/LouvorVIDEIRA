import { useState } from 'react'
import { Check, Inbox, MailWarning, Trash2, UserCheck, X } from 'lucide-react'
import { useMutation } from '@/hooks/useMutation'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { userService } from '@/services'
import type { User } from '@/types'
import { Avatar, Badge, Button, Card, CardBody, CardHeader, Field, Modal, Switch, Textarea } from '@/components/ui'

const STATUS: Record<string, { label: string; tone: 'brand' | 'neutral' | 'danger' }> = {
  PENDING_ADMIN_APPROVAL: { label: 'Pendente de aprovação', tone: 'brand' },
  PENDING_EMAIL_VERIFICATION: { label: 'Aguardando confirmação do e-mail', tone: 'neutral' },
  REJECTED: { label: 'Recusado', tone: 'danger' },
}

const requestedAt = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Solicitações de acesso: o botão Aprovar só fica disponível depois que a pessoa
 * confirmou o e-mail (a regra também é verificada no servidor).
 */
export function AccessRequestsCard({ requests, onRemove }: { requests: User[]; onRemove: (user: User) => void }) {
  const [rejecting, setRejecting] = useState<User | null>(null)
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)

  const approve = useMutation((id: string) => userService.approve(id), {
    success: ({ user, emailSent }) => `Acesso de ${user.name} aprovado${emailSent ? '. Avisamos por e-mail.' : ''}`,
    error: 'Não foi possível aprovar',
  })
  const reject = useMutation(({ id, reason, notify }: { id: string; reason: string; notify: boolean }) => userService.reject(id, reason, notify), {
    success: ({ user, emailSent }) => `Solicitação de ${user.name} recusada${emailSent ? '. Avisamos por e-mail.' : ''}`,
    error: 'Não foi possível recusar',
    onSuccess: () => setRejecting(null),
  })

  const openReject = (user: User) => {
    setReason('')
    setNotify(user.emailVerified)
    setRejecting(user)
  }

  if (requests.length === 0) return null
  const waiting = requests.filter((u) => u.status === 'PENDING_ADMIN_APPROVAL').length

  return (
    <Card className="border-brand-300 dark:border-brand-500/40">
      <CardHeader
        title="Solicitações de acesso"
        description="A aprovação só é liberada depois da confirmação do e-mail"
        icon={<Inbox />}
        action={waiting > 0 ? <Badge tone="brand">{waiting}</Badge> : undefined}
      />
      <CardBody className="pt-3">
        <ul className="divide-y divide-line">
          {requests.map((u) => {
            const status = STATUS[u.status] ?? STATUS.PENDING_ADMIN_APPROVAL!
            return (
              <li key={u.id} className="flex flex-wrap items-start gap-3 py-4">
                <Avatar name={u.name} size="sm" />
                <div className="min-w-0 flex-1 basis-56 space-y-1.5">
                  <div>
                    <p className="truncate text-sm font-semibold text-ink">{u.name}</p>
                    <p className="truncate text-xs text-ink-3">{u.email}</p>
                    <p className="text-xs text-ink-3">Solicitado em {requestedAt(u.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.emailVerified ? (
                      <Badge tone="success">
                        <Check /> E-mail verificado
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        <MailWarning /> E-mail não verificado
                      </Badge>
                    )}
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {u.role !== 'member' && <Badge tone="info">Nível: {USER_ROLE_LABELS[u.role]}</Badge>}
                  </div>
                  {u.status === 'REJECTED' && u.rejectionReason && <p className="text-xs text-ink-3">Motivo: {u.rejectionReason}</p>}
                </div>
                <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
                  <div className="flex gap-2">
                    {u.status === 'REJECTED' ? (
                      <Button size="sm" variant="danger-ghost" leftIcon={<Trash2 />} onClick={() => onRemove(u)}>
                        Remover
                      </Button>
                    ) : (
                      <Button size="sm" variant="danger-ghost" leftIcon={<X />} onClick={() => openReject(u)}>
                        Recusar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      leftIcon={<UserCheck />}
                      disabled={!u.emailVerified}
                      loading={approve.isPending}
                      onClick={() => void approve.mutate(u.id)}
                    >
                      Aprovar
                    </Button>
                  </div>
                  {!u.emailVerified && <p className="text-xs text-amber-700 dark:text-amber-300">Este usuário ainda não confirmou o e-mail.</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </CardBody>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Recusar a solicitação de ${rejecting?.name ?? ''}?`}
        description="A pessoa não poderá entrar no sistema."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={reject.isPending}
              onClick={() => rejecting && void reject.mutate({ id: rejecting.id, reason: reason.trim(), notify })}
            >
              Recusar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Motivo da recusa (opcional)" htmlFor="reject-reason" hint="Aparece para os administradores e, se escolhido, no e-mail.">
            <Textarea id="reject-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {rejecting?.emailVerified ? (
            <Switch checked={notify} onChange={setNotify} label="Avisar por e-mail" description="Envia uma mensagem informando que o pedido não foi aprovado." />
          ) : (
            <p className="text-xs text-ink-3">O e-mail não foi confirmado, então nenhuma mensagem será enviada.</p>
          )}
        </div>
      </Modal>
    </Card>
  )
}
