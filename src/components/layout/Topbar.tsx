import { CalendarPlus, ClipboardList, ListPlus, Mic2, Music, Plus, Search } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { Button, Dropdown, IconButton } from '@/components/ui'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { LogoMark } from './Logo'
import { UserMenu } from './UserMenu'
import { Link } from 'react-router-dom'

export function Topbar({ onSearch }: { onSearch: () => void }) {
  const { can } = useSession()
  const canCreate = can('repertoires:write') || can('songs:write')
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-xl lg:bg-canvas/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="Louvor Videira — início">
          <LogoMark className="size-8" />
          <span className="text-[15px] font-extrabold tracking-tight">Louvor Videira</span>
        </Link>

        <button
          type="button"
          onClick={onSearch}
          className="hidden h-10 w-full max-w-md items-center gap-3 rounded-xl bg-surface px-3.5 text-sm text-ink-3 shadow-xs ring-1 ring-line transition-colors ring-inset hover:ring-line-strong lg:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Buscar músicas, tons, repertórios…</span>
          <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] font-semibold ring-1 ring-line">
            {isMac ? '⌘' : 'Ctrl'} K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <IconButton label="Buscar" onClick={onSearch} className="lg:hidden">
            <Search />
          </IconButton>
          {canCreate && (
            <Dropdown
              trigger={({ toggle, ...aria }) => (
                <Button onClick={toggle} size="sm" leftIcon={<Plus />} className="hidden sm:inline-flex" {...aria}>
                  Novo
                </Button>
              )}
              items={[
                { label: 'Novo repertório', icon: <ListPlus />, href: '/repertorios/novo', hidden: !can('repertoires:write') },
                { label: 'Nova música', icon: <Music />, href: '/musicas/nova', hidden: !can('songs:write') },
                { label: 'Novo evento', icon: <CalendarPlus />, href: '/calendario?novo=1', hidden: !can('events:write') },
                { label: 'Nova escala', icon: <ClipboardList />, href: '/escalas/nova', hidden: !can('schedules:write') },
                { label: 'Novo ensaio', icon: <Mic2 />, href: '/ensaios?novo=1', hidden: !can('rehearsals:write') },
              ]}
            />
          )}
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
