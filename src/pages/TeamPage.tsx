import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, Mail, Pencil, Phone, Trash2, UserPlus, Users } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useMembers, useSchedules } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { MEMBER_ROLES, MEMBER_ROLE_LABELS, VOICE_LABELS } from '@/lib/constants'
import { formatDateShort, isUpcoming } from '@/lib/dates'
import { matchesQuery, pluralize } from '@/lib/utils'
import { memberService } from '@/services'
import type { Member, MemberRole } from '@/types'
import { Avatar, Badge, Button, Drawer, EmptyState, ErrorState, PageHeader, SearchBar, Select, SkeletonGrid } from '@/components/ui'
import { MemberCard } from '@/components/members/MemberCard'
import { MemberForm } from '@/components/members/MemberForm'
import { Link } from 'react-router-dom'

export default function TeamPage() {
  useDocumentTitle('Equipe')
  const { can } = useSession()
  const confirm = useConfirm()
  const { data: members = [], isLoading, error, refetch } = useMembers()
  const { data: schedules = [] } = useSchedules()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<MemberRole | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)

  const openId = params.get('integrante')
  const openMember = members.find((m) => m.id === openId) ?? null
  const setOpen = (id: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('integrante', id)
      else next.delete('integrante')
      return next
    })

  const filtered = useMemo(
    () =>
      members.filter(
        (m) => matchesQuery(query, m.name, m.instrument, m.roles.map((r) => MEMBER_ROLE_LABELS[r]).join(' ')) && (!role || m.roles.includes(role)),
      ),
    [members, query, role],
  )

  const upcomingFor = (memberId: string) =>
    schedules
      .filter((s) => isUpcoming(s.event.date, s.event.startTime))
      .flatMap((s) => {
        const roles = s.members.filter((m) => m.memberId === memberId).map((m) => MEMBER_ROLE_LABELS[m.role])
        return roles.length ? [{ schedule: s, roles }] : []
      })

  const remove = useMutation((id: string) => memberService.remove(id), {
    success: 'Integrante removido',
    onSuccess: () => setOpen(null),
  })

  const onDelete = async (member: Member) => {
    const ok = await confirm({
      title: `Remover ${member.name}?`,
      description: 'O integrante sairá de todas as escalas e perderá o registro de preparação. Considere marcá-lo como inativo.',
      confirmLabel: 'Remover',
      danger: true,
    })
    if (ok) void remove.mutate(member.id)
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Equipe"
        description={`${pluralize(members.filter((m) => m.active).length, 'integrante ativo', 'integrantes ativos')} no ministério de louvor.`}
        actions={
          can('members:write') && (
            <Button
              leftIcon={<UserPlus />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              Novo integrante
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nome ou instrumento…" className="flex-1" />
        <div className="sm:w-56">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole | '')}
            aria-label="Filtrar por função"
            placeholder="Todas as funções"
            options={MEMBER_ROLES.map((r) => ({ value: r, label: MEMBER_ROLE_LABELS[r] }))}
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonGrid count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={members.length === 0 ? 'Nenhum integrante cadastrado' : 'Ninguém encontrado'}
          description={members.length === 0 ? 'Cadastre os integrantes da equipe de louvor.' : 'Tente outro nome ou função.'}
          action={
            can('members:write') && members.length === 0 && (
              <Button leftIcon={<UserPlus />} onClick={() => setFormOpen(true)}>
                Novo integrante
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MemberCard key={m.id} member={m} onOpen={(member) => setOpen(member.id)} />
          ))}
        </div>
      )}

      {openMember && (
        <Drawer
          open
          onClose={() => setOpen(null)}
          title={openMember.name}
          description={openMember.roles.map((r) => MEMBER_ROLE_LABELS[r]).join(' · ')}
          footer={
            can('members:write') ? (
              <>
                <Button variant="danger-ghost" size="sm" leftIcon={<Trash2 />} onClick={() => void onDelete(openMember)} loading={remove.isPending}>
                  Remover
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Pencil />}
                  className="ml-auto"
                  onClick={() => {
                    setEditing(openMember)
                    setFormOpen(true)
                  }}
                >
                  Editar
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={openMember.name} src={openMember.photoUrl} size="xl" />
              <div className="space-y-1 text-sm">
                {openMember.instrument && <p className="font-semibold text-ink">{openMember.instrument}</p>}
                <p className="text-ink-2">Vocal: {VOICE_LABELS[openMember.voice]}</p>
                {!openMember.active && <Badge>Inativo</Badge>}
              </div>
            </div>
            <div className="space-y-2">
              {openMember.phone && (
                <a href={`tel:${openMember.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium text-ink hover:bg-surface-3">
                  <Phone className="size-4 text-ink-3" aria-hidden /> {openMember.phone}
                </a>
              )}
              {openMember.email && (
                <a href={`mailto:${openMember.email}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium break-all text-ink hover:bg-surface-3">
                  <Mail className="size-4 shrink-0 text-ink-3" aria-hidden /> {openMember.email}
                </a>
              )}
            </div>
            {openMember.notes && (
              <div>
                <p className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Observações</p>
                <p className="mt-1 text-sm text-ink-2">{openMember.notes}</p>
              </div>
            )}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                <CalendarCheck className="size-3.5" aria-hidden /> Próximas escalas
              </p>
              {upcomingFor(openMember.id).length === 0 ? (
                <p className="text-sm text-ink-3">Sem escalas futuras.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingFor(openMember.id).map(({ schedule, roles }) => (
                    <li key={schedule.id}>
                      <Link to={`/escalas/${schedule.id}`} className="block rounded-xl border border-line p-3 transition-colors hover:bg-surface-2">
                        <p className="text-sm font-semibold text-ink">
                          {schedule.event.title} · {formatDateShort(schedule.event.date)}
                        </p>
                        <p className="text-xs text-ink-3">{roles.join(', ')}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Drawer>
      )}

      <MemberForm open={formOpen} onClose={() => setFormOpen(false)} member={editing} />
    </div>
  )
}
