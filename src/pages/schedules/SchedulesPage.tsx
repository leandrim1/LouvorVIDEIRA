import { useMemo, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useSchedules } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { isUpcoming } from '@/lib/dates'
import { ButtonLink, EmptyState, ErrorState, PageHeader, SkeletonList, Tabs } from '@/components/ui'
import { ScheduleCard } from '@/components/schedules/ScheduleCard'

type Scope = 'upcoming' | 'mine' | 'past'

export default function SchedulesPage() {
  useDocumentTitle('Escalas')
  const { can, member } = useSession()
  const { data = [], isLoading, error, refetch } = useSchedules()
  const [scope, setScope] = useState<Scope>('upcoming')

  const lists = useMemo(() => {
    const upcoming = data.filter((s) => isUpcoming(s.event.date, s.event.startTime))
    return {
      upcoming,
      mine: upcoming.filter((s) => s.members.some((m) => m.memberId === member?.id)),
      past: data.filter((s) => !isUpcoming(s.event.date, s.event.startTime)).reverse(),
    }
  }, [data, member?.id])
  const list = lists[scope]

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Escalas"
        description="Quem vai tocar e cantar em cada culto."
        actions={
          can('schedules:write') && (
            <ButtonLink to="/escalas/nova" leftIcon={<Plus />}>
              Nova escala
            </ButtonLink>
          )
        }
      />
      <Tabs<Scope>
        label="Filtrar escalas"
        value={scope}
        onChange={setScope}
        className="mb-5"
        items={[
          { value: 'upcoming', label: 'Próximas', count: lists.upcoming.length },
          { value: 'mine', label: 'Minhas escalas', count: lists.mine.length },
          { value: 'past', label: 'Anteriores', count: lists.past.length },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList count={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={scope === 'mine' ? 'Você não está escalado' : 'Nenhuma escala encontrada'}
          description={scope === 'mine' ? 'Quando for escalado para um culto, ele aparecerá aqui.' : 'Monte a escala dos próximos cultos.'}
          action={
            can('schedules:write') && (
              <ButtonLink to="/escalas/nova" leftIcon={<Plus />}>
                Nova escala
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.map((s) => (
            <ScheduleCard key={s.id} schedule={s} memberId={member?.id} />
          ))}
        </div>
      )}
    </div>
  )
}
