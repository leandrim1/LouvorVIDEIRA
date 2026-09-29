import { Link } from 'react-router-dom'
import { ChevronRight, Moon, Sun } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useTheme } from '@/contexts/theme'
import { useNotifications } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { MORE_NAV } from '@/lib/navigation'
import { Avatar, Switch } from '@/components/ui'

export default function MorePage() {
  useDocumentTitle('Mais')
  const { user, member, can } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const { data: notifications = [] } = useNotifications()
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="animate-fade-up space-y-5">
      <h1 className="sr-only">Mais opções</h1>
      <Link to="/configuracoes#perfil" className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <Avatar name={user?.name ?? 'Visitante'} src={member?.photoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{user?.name ?? 'Visitante'}</p>
          <p className="text-sm text-ink-3">{user ? USER_ROLE_LABELS[user.role] : ''}</p>
        </div>
        <ChevronRight className="size-5 text-ink-3" aria-hidden />
      </Link>

      <nav aria-label="Mais opções" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {MORE_NAV.filter((i) => !i.permission || can(i.permission)).map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-surface-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                  <item.icon className="size-[18px]" aria-hidden />
                </span>
                <span className="flex-1 text-[15px] font-semibold text-ink">{item.label}</span>
                {item.to === '/notificacoes' && unread > 0 && (
                  <span className="tabular rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>
                )}
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
            {resolvedTheme === 'dark' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
          </span>
          <div className="flex-1">
            <Switch checked={resolvedTheme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label="Modo escuro" description="Ideal para ensaios e cultos" />
          </div>
        </div>
      </div>
    </div>
  )
}
