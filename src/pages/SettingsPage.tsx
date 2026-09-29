import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Database, Download, Monitor, Moon, RotateCcw, Sun, UserCog } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useTheme, type ThemePreference } from '@/contexts/theme'
import { useUsers } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useMutation } from '@/hooks/useMutation'
import { clearQueryCache } from '@/hooks/useQuery'
import { USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS } from '@/lib/constants'
import { cn, downloadJson } from '@/lib/utils'
import { db, isSupabaseConfigured } from '@/services'
import { Avatar, Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

const THEMES: Array<{ value: ThemePreference; label: string; icon: ReactNode; description: string }> = [
  { value: 'light', label: 'Claro', icon: <Sun />, description: 'Ideal para ambientes iluminados' },
  { value: 'dark', label: 'Escuro', icon: <Moon />, description: 'Recomendado para ensaios e cultos' },
  { value: 'system', label: 'Sistema', icon: <Monitor />, description: 'Segue o dispositivo' },
]

export default function SettingsPage() {
  useDocumentTitle('Configurações')
  const { theme, setTheme } = useTheme()
  const { user, switchUser } = useSession()
  const { data: users = [] } = useUsers()
  const confirm = useConfirm()
  const { hash } = useLocation()
  const [chordsFont, setChordsFont] = useLocalStorage('reader:chords', 15)
  const [lyricsFont, setLyricsFont] = useLocalStorage('reader:lyrics', 19)

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const reset = useMutation(
    async () => {
      await db.reset()
      clearQueryCache()
    },
    { success: 'Dados de demonstração restaurados' },
  )
  const exportData = useMutation(async () => downloadJson(`louvor-videira-${new Date().toISOString().slice(0, 10)}.json`, await db.exportAll()), {
    success: 'Backup exportado',
  })

  const ROLE_ORDER = { admin: 0, leader: 1, member: 2 } as const
  const sortedUsers = [...users].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="animate-fade-up">
      <PageHeader title="Configurações" description="Aparência, leitura e dados deste dispositivo." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Aparência" description="O modo escuro foi pensado para o palco" />
          <CardBody>
            <div role="radiogroup" aria-label="Tema" className="grid gap-2 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-2xl p-4 text-left ring-1 transition-all ring-inset [&_svg]:size-5',
                    theme === t.value ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/10' : 'ring-line hover:bg-surface-2',
                  )}
                >
                  <span className={theme === t.value ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3'}>{t.icon}</span>
                  <span className="text-sm font-bold text-ink">{t.label}</span>
                  <span className="text-xs text-ink-3">{t.description}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Leitura de cifras e letras" description="Tamanho padrão neste dispositivo" />
          <CardBody className="space-y-5">
            <label className="block">
              <span className="flex justify-between text-sm font-semibold text-ink">
                Cifra <span className="tabular text-ink-3">{chordsFont}px</span>
              </span>
              <input type="range" min={11} max={34} value={chordsFont} onChange={(e) => setChordsFont(Number(e.target.value))} className="mt-2 w-full accent-brand-600" />
            </label>
            <label className="block">
              <span className="flex justify-between text-sm font-semibold text-ink">
                Letra <span className="tabular text-ink-3">{lyricsFont}px</span>
              </span>
              <input type="range" min={11} max={34} value={lyricsFont} onChange={(e) => setLyricsFont(Number(e.target.value))} className="mt-2 w-full accent-brand-600" />
            </label>
            <p className="rounded-xl bg-surface-2 p-3 font-mono text-chord" style={{ fontSize: chordsFont }}>
              G&nbsp;&nbsp;&nbsp;&nbsp;D/F#&nbsp;&nbsp;Em
            </p>
          </CardBody>
        </Card>

        <Card id="perfil" className="scroll-mt-24 lg:col-span-2">
          <CardHeader title="Perfil de acesso (demonstração)" description="Troque de usuário para testar os níveis Administrador, Líder e Integrante" icon={<UserCog />} />
          <CardBody>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => switchUser(u.id)}
                  aria-pressed={user?.id === u.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all ring-inset',
                    user?.id === u.id ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/10' : 'ring-line hover:bg-surface-2',
                  )}
                >
                  <Avatar name={u.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{u.name}</span>
                    <span className="block truncate text-xs text-ink-3">{USER_ROLE_DESCRIPTIONS[u.role]}</span>
                  </span>
                  <Badge tone={u.role === 'admin' ? 'brand' : u.role === 'leader' ? 'info' : 'neutral'}>{USER_ROLE_LABELS[u.role]}</Badge>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Dados" description={isSupabaseConfigured ? 'Conectado ao Supabase' : 'Armazenados localmente neste navegador'} icon={<Database />} />
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-ink-2">
              {isSupabaseConfigured
                ? 'Os dados estão sendo lidos e gravados no Supabase. Restaurar a demonstração apaga as tabelas e insere os dados fictícios.'
                : 'O modo local usa dados de demonstração salvos no navegador. Configure VITE_DATA_PROVIDER=supabase para usar um banco real.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" leftIcon={<Download />} onClick={() => void exportData.mutate()} loading={exportData.isPending}>
                Exportar backup
              </Button>
              <Button
                variant="danger-ghost"
                leftIcon={<RotateCcw />}
                loading={reset.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Restaurar dados de demonstração?',
                    description: 'Todas as alterações feitas (músicas, repertórios, escalas…) serão substituídas pelos dados originais.',
                    confirmLabel: 'Restaurar',
                    danger: true,
                  })
                  if (ok) void reset.mutate()
                }}
              >
                Restaurar demonstração
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
