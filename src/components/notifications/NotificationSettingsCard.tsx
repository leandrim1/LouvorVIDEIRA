import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Monitor, Send, Smartphone, Trash2 } from 'lucide-react'
import { authErrorMessage } from '@/contexts/auth'
import { useConfirm } from '@/contexts/confirm'
import { useToast } from '@/contexts/toast'
import { formatDateTime, isMobileOs } from '@/lib/devices'
import { currentEndpointHash, pushService, type NotificationPreferences, type PushDevice, type PushState } from '@/services/pushService'
import { Badge, Button, Card, CardBody, CardHeader, SkeletonList, Switch } from '@/components/ui'

const STATE_TEXT: Record<PushState, string> = {
  on: 'As notificações estão ativadas neste aparelho.',
  off: 'Este aparelho ainda não recebe notificações.',
  default: 'Este aparelho ainda não recebe notificações.',
  denied: 'O navegador bloqueou as notificações deste site. Libere nas configurações do navegador (ícone de cadeado ao lado do endereço) e volte aqui.',
  unsupported: 'Este navegador não permite notificações push. Use o Chrome, Edge, Firefox ou Safari atualizados.',
  'needs-install': 'No iPhone e no iPad, as notificações só funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone.',
  'server-disabled': 'As notificações push ainda não foram configuradas no servidor (chaves VAPID).',
}

const PREFERENCES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'repertoires', label: 'Repertórios', description: 'Novos repertórios publicados' },
  { key: 'repertoireUpdates', label: 'Alterações em repertórios', description: 'Músicas, tons ou horários alterados' },
  { key: 'rehearsals', label: 'Ensaios', description: 'Ensaios agendados ou alterados' },
  { key: 'schedules', label: 'Escalas', description: 'Quando você for escalado ou a escala mudar' },
  { key: 'general', label: 'Avisos gerais', description: 'Comunicados da administração' },
  { key: 'pushEnabled', label: 'Notificações push', description: 'Desligado: não recebe push em nenhum aparelho; os avisos continuam na central.' },
]

/** Configurações → Notificações */
export function NotificationSettingsCard({ id, className }: { id?: string; className?: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [state, setState] = useState<PushState | null>(null)
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [devices, setDevices] = useState<PushDevice[] | null>(null)
  const [thisDevice, setThisDevice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const loadDevices = useCallback(
    () =>
      Promise.all([pushService.devices(), currentEndpointHash()]).then(
        ([list, hash]) => {
          setDevices(list)
          setThisDevice(hash)
        },
        () => setDevices([]),
      ),
    [],
  )

  useEffect(() => {
    void pushService.state().then(setState)
    void pushService.preferences().then(setPrefs, () => setPrefs(null))
    void loadDevices()
  }, [loadDevices])

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    try {
      await action()
    } catch (err) {
      toast.error('Não foi possível concluir', authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const enable = () =>
    run('enable', async () => {
      const next = await pushService.enable()
      setState(next)
      if (next === 'on') toast.success('Notificações ativadas', 'Você vai receber os avisos neste aparelho.')
      await loadDevices()
    })

  const disable = () =>
    run('disable', async () => {
      await pushService.disable()
      setState(await pushService.state())
      toast.success('Notificações desativadas neste aparelho')
      await loadDevices()
    })

  const sendTest = () =>
    run('test', async () => {
      const result = await pushService.sendTest()
      if (result.pushed > 0) toast.success('Notificação de teste enviada', 'Ela deve aparecer em instantes nos seus aparelhos.')
      else toast.info('Nenhum aparelho recebeu', 'Ative as notificações neste aparelho e confira se “Notificações push” está ligado.')
    })

  const toggle = (key: keyof NotificationPreferences, value: boolean) =>
    run(`pref-${key}`, async () => {
      setPrefs((p) => (p ? { ...p, [key]: value } : p))
      setPrefs(await pushService.savePreferences({ [key]: value }))
    })

  const remove = async (device: PushDevice) => {
    const ok = await confirm({
      title: 'Remover aparelho?',
      description: `${device.deviceName} deixará de receber notificações push. Para voltar a receber, ative novamente nele.`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    await run(device.id, async () => {
      if (device.endpointHash === thisDevice) await pushService.disable()
      else await pushService.removeDevice(device.id)
      toast.success('Aparelho removido')
      setState(await pushService.state())
      await loadDevices()
    })
  }

  return (
    <Card id={id} className={className}>
      <CardHeader title="Notificações" description="Avisos de repertórios, ensaios e escalas no celular e no computador" icon={<Bell />} />
      <CardBody className="space-y-6">
        <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
          <p className="text-sm font-semibold text-ink">Neste aparelho</p>
          <p className="mt-1 text-sm text-ink-3">{state ? STATE_TEXT[state] : 'Verificando…'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(state === 'default' || state === 'off') && (
              <Button size="sm" leftIcon={<BellRing />} loading={busy === 'enable'} onClick={() => void enable()}>
                Ativar notificações
              </Button>
            )}
            {state === 'on' && (
              <>
                <Button size="sm" variant="secondary" leftIcon={<Send />} loading={busy === 'test'} onClick={() => void sendTest()}>
                  Enviar notificação de teste
                </Button>
                <Button size="sm" variant="danger-ghost" leftIcon={<BellOff />} loading={busy === 'disable'} onClick={() => void disable()}>
                  Desativar neste aparelho
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-ink">O que você quer receber</p>
          {prefs === null ? (
            <SkeletonList count={3} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {PREFERENCES.map((p) => (
                <Switch
                  key={p.key}
                  checked={prefs[p.key]}
                  onChange={(v) => void toggle(p.key, v)}
                  label={p.label}
                  description={p.description}
                  disabled={busy === `pref-${p.key}`}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Dispositivos</p>
          {devices === null ? (
            <SkeletonList count={2} />
          ) : devices.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-3">
              Nenhum aparelho recebe notificações. Ative neste aparelho e nos outros em que você usa o Louvor Videira.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2 [&_svg]:size-5">
                    {isMobileOs(d.platform) ? <Smartphone /> : <Monitor />}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {d.deviceName || 'Navegador'}
                      {d.endpointHash === thisDevice ? <Badge tone="brand">Este aparelho</Badge> : <Badge tone="success">Notificações ativadas</Badge>}
                    </p>
                    <p className="text-xs text-ink-3">Última atividade: {formatDateTime(d.lastUsedAt ?? d.updatedAt)}</p>
                  </div>
                  <Button size="sm" variant="danger-ghost" leftIcon={<Trash2 />} loading={busy === d.id} onClick={() => void remove(d)}>
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
