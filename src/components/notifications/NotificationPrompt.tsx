import { useEffect, useState } from 'react'
import { BellRing, Share, X } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { readStorage, writeStorage } from '@/hooks/useLocalStorage'
import { pushService, type PushState } from '@/services/pushService'
import { Button } from '@/components/ui'

const DISMISS_KEY = 'push-prompt:dismissed-at'
/** Depois de "Agora não", o convite só volta a aparecer depois deste prazo */
const DISMISS_DAYS = 30

/** Convite discreto para ativar as notificações (nunca bloqueia o uso do sistema) */
export function NotificationPrompt() {
  const { user } = useSession()
  const toast = useToast()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(() => {
    const at = readStorage<number>(DISMISS_KEY, 0)
    return Date.now() - at < DISMISS_DAYS * 86_400_000
  })

  useEffect(() => {
    if (!user?.approved || hidden) return
    let active = true
    // Aguarda um instante para não disputar atenção com o carregamento da tela
    const timer = setTimeout(() => void pushService.state().then((s) => active && setState(s)), 1500)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user?.approved, hidden])

  const dismiss = () => {
    writeStorage(DISMISS_KEY, Date.now())
    setHidden(true)
  }

  const enable = async () => {
    setBusy(true)
    try {
      const next = await pushService.enable()
      if (next === 'on') {
        toast.success('Notificações ativadas', 'Você vai receber os avisos neste aparelho.')
        setHidden(true)
      } else if (next === 'denied') {
        toast.info('Notificações bloqueadas', 'Para ativar depois, libere as notificações do site nas configurações do navegador.')
        dismiss()
      } else {
        setState(next)
      }
    } catch {
      toast.error('Não foi possível ativar', 'Tente novamente em Configurações → Notificações.')
    } finally {
      setBusy(false)
    }
  }

  // 'off': a permissão já existe, mas este aparelho ainda não está inscrito
  if (hidden || (state !== 'default' && state !== 'off' && state !== 'needs-install')) return null

  return (
    <div
      role="dialog"
      aria-label="Ativar notificações"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md animate-fade-up rounded-2xl border border-line bg-surface p-4 shadow-xl shadow-zinc-950/10 lg:inset-x-auto lg:right-6 lg:bottom-6 dark:shadow-black/50"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <BellRing className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Ative as notificações</p>
          {state === 'needs-install' ? (
            <p className="mt-0.5 text-sm text-ink-3">
              No iPhone, adicione o Louvor Videira à tela de início: toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" />{' '}
              e em <strong className="font-semibold text-ink-2">Adicionar à Tela de Início</strong>. Depois, abra pelo ícone e ative aqui.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-3">Receba avisos quando novos repertórios, ensaios ou escalas forem adicionados.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(state === 'default' || state === 'off') && (
              <Button size="sm" leftIcon={<BellRing />} loading={busy} onClick={() => void enable()}>
                Ativar notificações
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Fechar">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
