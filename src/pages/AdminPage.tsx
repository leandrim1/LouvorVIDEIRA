import { Link } from 'react-router-dom'
import { CalendarPlus, Check, ClipboardList, ListPlus, Lock, Mic2, Music, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useMembers, useUsers } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { PERMISSION_LABELS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { userService } from '@/services'
import type { UserRole } from '@/types'
import { Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Select, SkeletonList } from '@/components/ui'

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
  const createAccess = useMutation((memberId: string) => userService.createForMember(members.find((m) => m.id === memberId)!, 'member'), {
    success: 'Acesso criado',
  })

  if (!can('admin:access')) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Área restrita a administradores"
        description="Troque para um perfil de administrador em Configurações para acessar."
        className="mt-10"
        action={
          <Link to="/configuracoes#perfil" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
            Ir para Configurações
          </Link>
        }
      />
    )
  }

  const membersWithoutAccess = members.filter((m) => !users.some((u) => u.memberId === m.id))
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
        <Card className="xl:col-span-3">
          <CardHeader title="Usuários e permissões" description={`${users.length} usuários com acesso`} />
          <CardBody className="pt-3">
            {isLoading ? (
              <SkeletonList count={4} />
            ) : (
              <ul className="divide-y divide-line">
                {users.map((u) => {
                  const member = members.find((m) => m.id === u.memberId)
                  return (
                    <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Avatar name={u.name} src={member?.photoUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {u.name} {u.id === me?.id && <span className="text-xs font-medium text-ink-3">(você)</span>}
                        </p>
                        <p className="truncate text-xs text-ink-3">{u.email}</p>
                      </div>
                      <div className="w-40">
                        <Select
                          aria-label={`Nível de acesso de ${u.name}`}
                          value={u.role}
                          onChange={(e) => void updateRole.mutate({ id: u.id, role: e.target.value as UserRole })}
                          options={ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {membersWithoutAccess.length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-4">
                <p className="mb-2 text-sm font-semibold text-ink">Integrantes sem acesso</p>
                <ul className="space-y-2">
                  {membersWithoutAccess.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar name={m.name} src={m.photoUrl} size="xs" />
                      <span className="flex-1 truncate text-sm text-ink-2">{m.name}</span>
                      <Button size="xs" variant="soft" leftIcon={<UserPlus />} onClick={() => void createAccess.mutate(m.id)}>
                        Criar acesso
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
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
  )
}
