import { NavLink, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { MOBILE_NAV, MORE_NAV } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const itemClass = (active: boolean) =>
  cn(
    'relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold transition-colors',
    active ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 hover:text-ink-2',
  )

export function BottomNav({ unread }: { unread: number }) {
  const { pathname } = useLocation()
  const moreActive = pathname === '/mais' || MORE_NAV.some((i) => pathname.startsWith(i.to))

  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-2">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => itemClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-brand-50 dark:bg-brand-500/15',
                    )}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
        <NavLink to="/mais" className={() => itemClass(moreActive)} aria-current={moreActive ? 'page' : undefined}>
          <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full', moreActive && 'bg-brand-50 dark:bg-brand-500/15')}>
            <Menu className="size-5" strokeWidth={moreActive ? 2.4 : 2} aria-hidden />
            {unread > 0 && <span className="absolute top-0.5 right-2.5 size-2 rounded-full bg-red-500 ring-2 ring-surface" aria-label={`${unread} notificações não lidas`} />}
          </span>
          Mais
        </NavLink>
      </div>
    </nav>
  )
}
