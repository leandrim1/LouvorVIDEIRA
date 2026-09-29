import { LogOut, Moon, Settings, ShieldCheck, Sun, UserCog } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useSession } from '@/contexts/session'
import { useTheme } from '@/contexts/theme'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { Avatar, Dropdown } from '@/components/ui'

export function UserMenu() {
  const { user, member, can } = useSession()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { mode, signOut } = useAuth()
  const name = user?.name ?? 'Visitante'

  return (
    <Dropdown
      header={
        <div className="mb-1.5 border-b border-line px-2.5 pt-1 pb-2.5">
          <p className="truncate text-sm font-bold text-ink">{name}</p>
          <p className="truncate text-xs text-ink-3">
            {user ? USER_ROLE_LABELS[user.role] : '—'} · {user?.email}
          </p>
        </div>
      }
      trigger={({ toggle, ...aria }) => (
        <button type="button" onClick={toggle} className="rounded-full" aria-label="Menu do usuário" {...aria}>
          <Avatar name={name} src={member?.photoUrl} size="sm" className="ring-line" />
        </button>
      )}
      items={[
        {
          label: resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro',
          icon: resolvedTheme === 'dark' ? <Sun /> : <Moon />,
          onSelect: toggleTheme,
        },
        { label: 'Configurações', icon: <Settings />, href: '/configuracoes' },
        { label: 'Trocar perfil (demo)', icon: <UserCog />, href: '/configuracoes#perfil', hidden: mode !== 'demo' },
        { label: 'Administração', icon: <ShieldCheck />, href: '/admin', hidden: !can('admin:access') },
        { label: 'Sair', icon: <LogOut />, onSelect: () => void signOut(), hidden: mode !== 'server', separatorBefore: true, danger: true },
      ]}
    />
  )
}
