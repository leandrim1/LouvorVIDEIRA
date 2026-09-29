import { NavLink } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useTheme } from '@/contexts/theme'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import { Logo } from './Logo'

function SidebarLink({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
            : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 group-hover:text-ink-2')} aria-hidden />
          <span className="flex-1 truncate">{item.label}</span>
          {badge ? (
            <span className="tabular rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] leading-none font-bold text-white">{badge}</span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ unread }: { unread: number }) {
  const { user, member, can } = useSession()
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </div>
      <nav aria-label="Navegação principal" className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
        <div>
          <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-ink-3 uppercase">Sistema</p>
          <div className="space-y-0.5">
            {SECONDARY_NAV.filter((i) => !i.permission || can(i.permission)).map((item) => (
              <SidebarLink key={item.to} item={item} badge={item.to === '/notificacoes' ? unread : undefined} />
            ))}
          </div>
        </div>
      </nav>
      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar name={user?.name ?? 'Visitante'} src={member?.photoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user?.name ?? 'Visitante'}</p>
            <p className="truncate text-xs text-ink-3">{user ? USER_ROLE_LABELS[user.role] : '—'}</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={resolvedTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
