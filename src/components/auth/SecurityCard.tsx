import { useCallback, useEffect, useState } from 'react'
import { LogOut, Monitor, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { authErrorMessage, useAuth } from '@/contexts/auth'
import { useConfirm } from '@/contexts/confirm'
import { useToast } from '@/contexts/toast'
import { formatDateTime, isMobileOs } from '@/lib/devices'
import { authService, type TrustedDevice } from '@/services/authService'
import { Badge, Button, Card, CardBody, CardHeader, SkeletonList } from '@/components/ui'

/** Configurações → Segurança: dispositivos confiáveis, revogação e "sair de todos" */
export function SecurityCard({ className }: { className?: string }) {
  const { signOutEverywhere } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    () =>
      authService.devices().then(setDevices, (err: unknown) => {
        toast.error('Não foi possível carregar os dispositivos', authErrorMessage(err))
        setDevices([])
      }),
    [toast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await load()
    } catch (err) {
      toast.error('Não foi possível concluir', authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const active = (devices ?? []).filter((d) => d.status === 'active')
  const currentTrusted = active.some((d) => d.current)

  const onRevoke = async (device: TrustedDevice) => {
    const ok = await confirm({
      title: 'Revogar dispositivo?',
      description: `${device.deviceName}${device.current ? ' (este dispositivo)' : ''} voltará a pedir o código de acesso no próximo login.`,
      confirmLabel: 'Revogar',
      danger: true,
    })
    if (ok) await run(device.id, () => authService.revokeDevice(device.id), 'Dispositivo revogado')
  }

  const onRevokeAll = async () => {
    const ok = await confirm({
      title: 'Revogar todos os dispositivos?',
      description: 'Isso encerrará a confiança em todos os dispositivos cadastrados. Você precisará confirmar um código novamente ao entrar.',
      confirmLabel: 'Revogar todos',
      danger: true,
    })
    if (ok) await run('all', () => authService.revokeAllDevices(), 'Todos os dispositivos foram revogados')
  }

  const onSignOutEverywhere = async () => {
    const ok = await confirm({
      title: 'Sair de todos os dispositivos?',
      description: 'Todas as sessões serão encerradas, inclusive esta, e nenhum dispositivo continuará confiável. Os próximos logins pedirão o código.',
      confirmLabel: 'Sair de todos',
      danger: true,
    })
    if (ok) {
      setBusy('logout-all')
      await signOutEverywhere().catch((err: unknown) => toast.error('Não foi possível sair', authErrorMessage(err)))
    }
  }

  return (
    <Card className={className}>
      <CardHeader
        title="Segurança"
        description="Dispositivos confiáveis entram sem o código enviado por e-mail durante 30 dias."
        icon={<ShieldCheck />}
      />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Dispositivos confiáveis</p>
          {devices === null ? (
            <SkeletonList count={2} />
          ) : active.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-3">
              Nenhum dispositivo confiável. Ao entrar, marque “Confiar neste dispositivo” para não precisar do código neste aparelho.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {active.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2 [&_svg]:size-5">
                    {isMobileOs(d.os) ? <Smartphone /> : <Monitor />}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {d.deviceName}
                      {d.current ? <Badge tone="brand">Este dispositivo</Badge> : <Badge tone="success">Dispositivo confiável</Badge>}
                    </p>
                    <p className="text-xs text-ink-3">Último acesso: {formatDateTime(d.lastUsedAt)}</p>
                    <p className="text-xs text-ink-3">Confiável até {formatDateTime(d.expiresAt)}</p>
                  </div>
                  <Button size="sm" variant="danger-ghost" leftIcon={<ShieldOff />} loading={busy === d.id} onClick={() => void onRevoke(d)}>
                    Revogar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {currentTrusted && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ShieldOff />}
              loading={busy === 'current'}
              onClick={() => void run('current', () => authService.revokeCurrentDevice(), 'Este dispositivo deixou de ser confiável')}
            >
              Revogar este dispositivo
            </Button>
          )}
          {active.length > 0 && (
            <Button variant="secondary" size="sm" leftIcon={<ShieldOff />} loading={busy === 'all'} onClick={() => void onRevokeAll()}>
              Revogar todos os dispositivos
            </Button>
          )}
          <Button variant="danger-ghost" size="sm" leftIcon={<LogOut />} loading={busy === 'logout-all'} onClick={() => void onSignOutEverywhere()}>
            Sair de todos os dispositivos
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
