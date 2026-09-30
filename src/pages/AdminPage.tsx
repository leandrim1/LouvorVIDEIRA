import { Link } from 'react-router-dom'
import { CalendarPlus, Check, MonitorSmartphone, ClipboardList, KeyRound, ListPlus, Lock, Mic2, MoreHorizontal, Music, ShieldCheck, ShieldOff, Trash2, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useState } from 'react'
import { useConfirm } from '@/contexts/confirm'
import { useToast } from '@/contexts/toast'
import { useSession } from '@/contexts/session'
import { useMembers, useUsers } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { PERMISSION_LABELS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { userService } from '@/services'
import { AccessRequestsCard } from '@/components/auth/AccessRequestsCard'
import { UserDevicesModal } from '@/components/auth/UserDevicesModal'
import { PushStatsCard } from '@/components/notifications/PushStatsCard'
import type { User, UserRole } from '@/types'
import { Avatar, Badge, Button, Card, CardBody, CardHeader, Dropdown, EmptyState, IconButton, PageHeader, Select, SkeletonList } from '@/components/ui'

const ROLES: UserRole[] = ['admin', 'leader', 'member']

export default function AdminPage() {
  useDocumentTitle('Administração')
  const { can, user: me } = useSession()
  const { data: users = [], isLoading } = useUsers()
  const { data: members = [] } = useMembers()
  const updateRole = useMutation(({ id, role }: { id: string; role: UserRole }) => userService.updateRole(id, role), {
    success: (u) => `${u.name} agora é ${USER_ROLE_LABELS[u.role]}`,
    error: 'Não foi possível alterar a permissão',
  })
  const { mode } = useAuth()
  const confirm = useConfirm()
  const createAccess = useMutation((memberId: string) => userService.createForMember(members.find((m) => m.id === memberId)!, 'member'), {
    success: mode === 'server' ? 'Convite criado. Peça para a pessoa criar a conta com este e-mail.' : 'Acesso criado',
    error: 'Não foi possível criar o acesso',
  })
  const suspend = useMutation((id: string) => userService.suspend(id), {
    success: ({ user }) => `Acesso de ${user.name} suspenso`,
    error: 'Não foi possível suspender o acesso',
  })
  const reactivate = useMutation((id: string) => userService.approve(id), {
    success: ({ user }) => `Acesso de ${user.name} reativado`,
    error: 'Não foi possível reativar o acesso',
  })
  const linkMember = useMutation(({ id, memberId }: { id: string; memberId: string | null }) => userService.linkMember(id, memberId), {
    success: 'Integrante vinculado',
  })
  const removeUser = useMutation((id: string) => userService.remove(id), { success: 'Acesso removido' })
  const [devicesOf, setDevicesOf] = useState<User | null>(null)
  const toast = useToast()
  const resetPassword = useMutation((id: string) => userService.resetPassword(id), {
    error: 'Não foi possível gerar a senha temporária',
  })

  /** Senha temporária: exibida apenas uma vez para o administrador enviar à pessoa */
  const onResetPassword = async (u: User) => {
    const ok = await confirm({
      title: `Gerar senha temporária para ${u.name}?`,
      description: u.registered
        ? 'A senha atual deixa de funcionar e a pessoa é desconectada dos aparelhos.'
        : 'A pessoa poderá entrar com o e-mail cadastrado e esta senha.',
      confirmLabel: 'Gerar senha',
    })
    if (!ok) return
    const password = await resetPassword.mutate(u.id)
    if (!password) return
    const copy = await confirm({
      title: `Senha temporária: ${password}`,
      description: `Envie para ${u.name} por um canal privado. Ela não será exibida novamente. Depois de entrar, a pessoa troca a senha em Configurações.`,
      confirmLabel: 'Copiar senha',
      cancelLabel: 'Fechar',
    })
    if (copy) {
      try {
        await navigator.clipboard.writeText(password)
        toast.success('Senha copiada')
      } catch {
        toast.error('Não foi possível copiar', password)
      }
    }
  }

  const onRemove = async (u: User) => {
    const ok = await confirm({
      title: `Remover o acesso de ${u.name}?`,
      description: 'A pessoa não conseguirá mais usar o sistema. O cadastro dela na Equipe continua.',
      confirmLabel: 'Remover acesso',
      danger: true,
    })
    if (ok) void removeUser.mutate(u.id)
  }

  if (!can('admin:access')) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Área restrita a administradores"
        description={
          mode === 'demo'
            ? 'Troque para um perfil de administrador em Configurações para acessar.'
            : 'Peça a um administrador da equipe para alterar seu nível de acesso.'
        }
        className="mt-10"
        action={
          mode === 'demo' && (
            <Link to="/configuracoes#perfil" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
              Ir para Configurações
            </Link>
          )
        }
      />
    )
  }

  const membersWithoutAccess = members.filter((m) => !users.some((u) => u.memberId === m.id))
  const REQUEST_ORDER: Record<string, number> = { PENDING_ADMIN_APPROVAL: 0, PENDING_EMAIL_VERIFICATION: 1, REJECTED: 2 }
  const requests = users
    .filter((u) => u.registered && u.status in REQUEST_ORDER)
    .sort((a, b) => REQUEST_ORDER[a.status]! - REQUEST_ORDER[b.status]! || b.createdAt.localeCompare(a.createdAt))
  const activeUsers = users.filter((u) => !u.registered || u.status === 'APPROVED' || u.status === 'SUSPENDED')
  const shortcuts = [
    { to: '/musicas/nova', label: 'Nova música', icon: <Music /> },
    { to: '/repertorios/novo', label: 'Novo repertório', icon: <ListPlus /> },
    { to: '/calendario?novo=1', label: 'Novo evento', icon: <CalendarPlus /> },
    { to: '/escalas/nova', label: 'Nova escala', icon: <ClipboardList /> },
    { to: '/ensaios?novo=1', label: 'Novo ensaio', icon: <Mic2 /> },
    { to: '/equipe', label: 'Gerenciar integrantes', icon: <Users /> },
  ]

  return (
    <div className="animate-fade-up">
      <PageHeader title="Administração" description="Gerencie o conteúdo, a equipe e os níveis de acesso." eyebrow={<Badge tone="brand"><ShieldCheck /> Administrador</Badge>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shortcuts.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm font-semibold text-ink shadow-xs transition-all hover:border-line-strong hover:shadow-md [&_svg]:size-5 [&_svg]:text-brand-600 dark:[&_svg]:text-brand-300"
          >
            {s.icon}
            {s.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <AccessRequestsCard requests={requests} onRemove={(u) => void onRemove(u)} />

          <Card>
            <CardHeader title="Usuários e permissões" description={`${activeUsers.length} usuários`} />
            <CardBody className="pt-3">
              {isLoading ? (
                <SkeletonList count={4} />
              ) : (
                <ul className="divide-y divide-line">
                  {activeUsers.map((u) => {
                    const member = members.find((m) => m.id === u.memberId)
                    const isMe = u.id === me?.id
                    return (
                      <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                        <Avatar name={u.name} src={member?.photoUrl} size="sm" />
                        <div className="min-w-0 flex-1 basis-44">
                          <p className="truncate text-sm font-semibold text-ink">
                            {u.name} {isMe && <span className="text-xs font-medium text-ink-3">(você)</span>}
                          </p>
                          <p className="truncate text-xs text-ink-3">
                            {u.email}
                            {mode === 'server' && !u.registered && ' · convite criado, conta ainda não ativada'}
                            {u.status === 'SUSPENDED' && ' · acesso suspenso'}
                            {u.registered && u.status === 'APPROVED' && !u.emailVerified && ' · aguardando confirmação do novo e-mail'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-36">
                            <Select
                              aria-label={`Nível de acesso de ${u.name}`}
                              value={u.role}
                              onChange={(e) => void updateRole.mutate({ id: u.id, role: e.target.value as UserRole })}
                              options={ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))}
                            />
                          </div>
                          {!isMe && (
                            <Dropdown
                              trigger={({ toggle, ...aria }) => (
                                <IconButton label={`Mais ações para ${u.name}`} size="icon-sm" onClick={toggle} {...aria}>
                                  <MoreHorizontal />
                                </IconButton>
                              )}
                              items={[
                                ...(u.status === 'APPROVED' && u.registered
                                  ? [{ label: 'Suspender acesso', icon: <ShieldOff />, onSelect: () => void suspend.mutate(u.id) }]
                                  : []),
                                ...(u.status === 'SUSPENDED'
                                  ? [{ label: 'Reativar acesso', icon: <UserCheck />, onSelect: () => void reactivate.mutate(u.id) }]
                                  : []),
                                ...(mode === 'server' && u.registered
                                  ? [{ label: 'Dispositivos', icon: <MonitorSmartphone />, onSelect: () => setDevicesOf(u) }]
                                  : []),
                                ...(mode === 'server' && u.emailVerified
                                  ? [{ label: 'Gerar senha temporária', icon: <KeyRound />, onSelect: () => void onResetPassword(u) }]
                                  : []),
                                { label: 'Remover acesso', icon: <Trash2 />, onSelect: () => void onRemove(u), danger: true, separatorBefore: true },
                              ]}
                            />
                          )}
                        </div>
                        <div className="w-full pl-11 sm:w-auto sm:pl-0">
                          <label className="flex items-center gap-2 text-xs text-ink-3">
                            <span className="shrink-0">Integrante:</span>
                            <select
                              value={u.memberId ?? ''}
                              onChange={(e) => void linkMember.mutate({ id: u.id, memberId: e.target.value || null })}
                              className="max-w-52 rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-ink ring-1 ring-line ring-inset"
                              aria-label={`Integrante vinculado a ${u.name}`}
                            >
                              <option value="">Nenhum</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {membersWithoutAccess.length > 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-4">
                  <p className="text-sm font-semibold text-ink">Integrantes sem acesso</p>
                  <p className="mb-3 text-xs text-ink-3">
                    {mode === 'server'
                      ? 'Convide pelo e-mail cadastrado na Equipe. A pessoa cria a conta com esse e-mail, confirma o endereço e a solicitação aparece acima para aprovação.'
                      : 'Crie um acesso para o integrante.'}
                  </p>
                  <ul className="space-y-2">
                    {membersWithoutAccess.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <Avatar name={m.name} src={m.photoUrl} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                          {m.name}
                          {m.email && <span className="text-ink-3"> · {m.email}</span>}
                        </span>
                        {m.email ? (
                          <Button size="xs" variant="soft" leftIcon={<UserPlus />} onClick={() => void createAccess.mutate(m.id)}>
                            {mode === 'server' ? 'Convidar' : 'Criar acesso'}
                          </Button>
                        ) : (
                          <Link to={`/equipe?integrante=${m.id}`} className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                            Cadastrar e-mail
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
        {mode === 'server' && <PushStatsCard />}
        <Card>
          <CardHeader title="Níveis de acesso" description="O que cada perfil pode fazer" />
          <CardBody className="relative overflow-x-auto pt-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-ink-3">
                  <th scope="col" className="py-2 pr-3 font-semibold">Permissão</th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="px-2 py-2 text-center font-semibold">
                      {USER_ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-2.5 pr-3 text-ink-2">Consultar repertórios, músicas e escalas</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 text-center">
                      <Check className="mx-auto size-4 text-emerald-500" aria-label="Permitido" />
                    </td>
                  ))}
                </tr>
                {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => (
                  <tr key={p}>
                    <td className="py-2.5 pr-3 text-ink-2">{PERMISSION_LABELS[p]}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-2 text-center">
                        {ROLE_PERMISSIONS[r].includes(p) ? (
                          <Check className="mx-auto size-4 text-emerald-500" aria-label="Permitido" />
                        ) : (
                          <X className="mx-auto size-4 text-ink-3/60" aria-label="Não permitido" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        </div>
      </div>
      <UserDevicesModal user={devicesOf} onClose={() => setDevicesOf(null)} />
    </div>
  )
}
