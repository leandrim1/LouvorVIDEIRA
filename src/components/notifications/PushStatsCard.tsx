import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { pushService, type PushStats } from '@/services/pushService'
import { Card, CardBody, CardHeader, SkeletonList } from '@/components/ui'

/** Administração → Notificações: alcance e resultado dos envios push */
export function PushStatsCard({ className }: { className?: string }) {
  const [stats, setStats] = useState<PushStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void pushService.stats().then(setStats, () => setFailed(true))
  }, [])

  const items = stats
    ? [
        { label: 'Usuários com notificações', value: stats.usersWithPush },
        { label: 'Dispositivos registrados', value: stats.devices },
        { label: 'Notificações enviadas', value: stats.sent },
        { label: 'Falhas de envio', value: stats.failed },
      ]
    : []

  return (
    <Card className={className}>
      <CardHeader
        title="Notificações"
        description={stats && !stats.enabled ? 'Push desativado: configure as chaves VAPID no servidor' : 'Notificações push dos aparelhos da equipe'}
        icon={<BellRing />}
      />
      <CardBody className="pt-3">
        {failed ? (
          <p className="text-sm text-ink-3">Não foi possível carregar as estatísticas.</p>
        ) : !stats ? (
          <SkeletonList count={2} />
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            {items.map((i) => (
              <div key={i.label} className="rounded-2xl bg-surface-2 p-3">
                <dt className="text-xs text-ink-3">{i.label}</dt>
                <dd className="tabular mt-1 text-2xl font-extrabold text-ink">{i.value}</dd>
              </div>
            ))}
            {stats.expired > 0 && (
              <p className="col-span-2 text-xs text-ink-3">{stats.expired} inscrições expiradas foram desativadas automaticamente.</p>
            )}
          </dl>
        )}
      </CardBody>
    </Card>
  )
}
