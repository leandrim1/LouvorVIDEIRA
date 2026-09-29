import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mic2, Plus } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useRehearsals, useRepertoires } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { formatDateShort, isUpcoming } from '@/lib/dates'
import { rehearsalService } from '@/services'
import type { RehearsalDetail } from '@/types'
import { Button, EmptyState, ErrorState, PageHeader, SkeletonList, Tabs } from '@/components/ui'
import { RehearsalCard } from '@/components/rehearsals/RehearsalCard'
import { RehearsalForm } from '@/components/rehearsals/RehearsalForm'

type Scope = 'upcoming' | 'past'

export default function RehearsalsPage() {
  useDocumentTitle('Ensaios')
  const { can } = useSession()
  const confirm = useConfirm()
  const { data = [], isLoading, error, refetch } = useRehearsals()
  const { data: repertoires = [] } = useRepertoires()
  const [params, setParams] = useSearchParams()
  const [scope, setScope] = useState<Scope>('upcoming')
  const [editing, setEditing] = useState<RehearsalDetail | null>(null)

  const creating = params.get('novo') === '1'
  const closeForm = () => {
    setEditing(null)
    if (creating)
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('novo')
          next.delete('repertorio')
          return next
        },
        { replace: true },
      )
  }

  const lists = useMemo(
    () => ({
      upcoming: data.filter((r) => isUpcoming(r.event.date, r.event.startTime)),
      past: data.filter((r) => !isUpcoming(r.event.date, r.event.startTime)).reverse(),
    }),
    [data],
  )
  const list = lists[scope]

  const remove = useMutation((id: string) => rehearsalService.remove(id), { success: 'Ensaio excluído' })
  const onDelete = async (r: RehearsalDetail) => {
    if (await confirm({ title: 'Excluir ensaio?', description: `${r.event.title} de ${formatDateShort(r.event.date)} será removido do calendário.`, confirmLabel: 'Excluir', danger: true })) {
      void remove.mutate(r.id)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Ensaios"
        description="Agenda de ensaios com o repertório que será trabalhado."
        actions={
          can('rehearsals:write') && (
            <Button leftIcon={<Plus />} onClick={() => setParams({ novo: '1' })}>
              Novo ensaio
            </Button>
          )
        }
      />
      <Tabs<Scope>
        label="Período"
        value={scope}
        onChange={setScope}
        className="mb-5"
        items={[
          { value: 'upcoming', label: 'Próximos', count: lists.upcoming.length },
          { value: 'past', label: 'Anteriores', count: lists.past.length },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList count={3} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Mic2 />}
          title={scope === 'upcoming' ? 'Nenhum ensaio agendado' : 'Nenhum ensaio anterior'}
          description="Agende um ensaio e vincule o repertório para a equipe se preparar."
          action={
            can('rehearsals:write') && (
              <Button leftIcon={<Plus />} onClick={() => setParams({ novo: '1' })}>
                Novo ensaio
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <RehearsalCard
              key={r.id}
              rehearsal={r}
              onEdit={can('rehearsals:write') ? () => setEditing(r) : undefined}
              onDelete={can('rehearsals:write') ? () => void onDelete(r) : undefined}
            />
          ))}
        </div>
      )}

      <RehearsalForm
        open={creating || editing !== null}
        onClose={closeForm}
        rehearsal={editing}
        repertoires={repertoires}
        defaultRepertoireId={params.get('repertorio')}
      />
    </div>
  )
}
