import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useNotifications } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { notificationService } from '@/services'
import { Button, ErrorState, PageHeader, SkeletonList, Tabs } from '@/components/ui'
import { NotificationList } from '@/components/notifications/NotificationList'

export default function NotificationsPage() {
  useDocumentTitle('Notificações')
  const { user } = useSession()
  const { data = [], isLoading, error, refetch } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const unread = data.filter((n) => !n.read)
  const markAll = useMutation(() => notificationService.markAllRead(user!.id), { success: 'Todas marcadas como lidas' })

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Notificações"
        description="Novos repertórios, mudanças de tom, ensaios e escalas."
        actions={
          <Button variant="secondary" leftIcon={<CheckCheck />} onClick={() => void markAll.mutate()} disabled={unread.length === 0} loading={markAll.isPending}>
            Marcar todas como lidas
          </Button>
        }
      />
      <Tabs
        label="Filtrar notificações"
        value={filter}
        onChange={setFilter}
        className="mb-4"
        items={[
          { value: 'all', label: 'Todas', count: data.length },
          { value: 'unread', label: 'Não lidas', count: unread.length },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList count={5} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <NotificationList items={filter === 'unread' ? unread : data} onRead={(id) => user && void notificationService.markRead(id, user.id)} />
        </div>
      )}
    </div>
  )
}
