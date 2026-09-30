import { useCallback, useEffect, useState } from 'react'
import { Monitor, ShieldOff, Smartphone } from 'lucide-react'
import { authErrorMessage } from '@/contexts/auth'
import { useConfirm } from '@/contexts/confirm'
import { useToast } from '@/contexts/toast'
import { authService, type TrustedDevice } from '@/services/authService'
import type { User } from '@/types'
import { Badge, Button, Modal, SkeletonList } from '@/components/ui'
import { formatDateTime, isMobileOs } from '@/lib/devices'

const STATUS: Record<TrustedDevice['status'], { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  active: { label: 'Confiável', tone: 'success' },
  expired: { label: 'Expirado', tone: 'neutral' },
  revoked: { label: 'Revogado', tone: 'danger' },
}

/** Administrador: dispositivos confiáveis de um usuário, com revogação */
export function UserDevicesModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  return (
    <Modal open={user !== null} onClose={onClose} size="lg" title={`Dispositivos de ${user?.name ?? ''}`} description={user?.email}>
      {user && <DeviceList key={user.id} user={user} />}
    </Modal>
  )
}

function DeviceList({ user }: { user: User }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [devices, setDevices] = useState<TrustedDevice[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    () =>
      authService.userDevices(user.id).then(setDevices, (err: unknown) => {
        toast.error('Não foi possível carregar os dispositivos', authErrorMessage(err))
        setDevices([])
      }),
    [user.id, toast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const revoke = async (device: TrustedDevice) => {
    const ok = await confirm({
      title: 'Revogar dispositivo?',
      description: `${device.deviceName} de ${user.name} voltará a pedir o código de acesso no próximo login.`,
      confirmLabel: 'Revogar',
      danger: true,
    })
    if (!ok) return
    setBusy(device.id)
    try {
      await authService.revokeUserDevice(user.id, device.id)
      toast.success('Dispositivo revogado')
      await load()
    } catch (err) {
      toast.error('Não foi possível revogar', authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (devices === null) return <SkeletonList count={2} />
  if (devices.length === 0) return <p className="text-sm text-ink-3">Nenhum dispositivo confiável registrado para este usuário.</p>
  return (
    <ul className="divide-y divide-line">
      {devices.map((d) => (
        <li key={d.id} className="flex flex-wrap items-start gap-3 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2 [&_svg]:size-5">
            {isMobileOs(d.os) ? <Smartphone /> : <Monitor />}
          </span>
          <div className="min-w-0 flex-1 basis-56 space-y-0.5">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              {d.deviceName}
              <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
            </p>
            <p className="text-xs text-ink-3">
              Navegador: {d.browser} · Sistema: {d.os}
            </p>
            <p className="text-xs text-ink-3">
              Último acesso: {formatDateTime(d.lastUsedAt)} · Criado em: {formatDateTime(d.createdAt)}
            </p>
          </div>
          {d.status === 'active' && (
            <Button size="sm" variant="danger-ghost" leftIcon={<ShieldOff />} loading={busy === d.id} onClick={() => void revoke(d)}>
              Revogar
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
