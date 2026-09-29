import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useNotifications } from '@/hooks/useData'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { notificationService } from '@/services'
import { cn } from '@/lib/utils'
import { NotificationList } from './NotificationList'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const { user } = useSession()
  const { data = [] } = useNotifications()
  const unread = data.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markRead = (id: string) => user && void notificationService.markRead(id, user.id)
  const markAll = () => user && void notificationService.markAllRead(user.id)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (isDesktop ? setOpen((o) => !o) : navigate('/notificacoes'))}
        className="relative flex size-10 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label={unread ? `Notificações (${unread} não lidas)` : 'Notificações'}
        aria-expanded={isDesktop ? open : undefined}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute top-full right-0 z-40 mt-2 w-[380px] origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-zinc-950/10 dark:shadow-black/50"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">Notificações</p>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors',
                unread ? 'text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10' : 'text-ink-3',
              )}
            >
              <CheckCheck className="size-3.5" /> Marcar todas como lidas
            </button>
          </div>
          <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
            <NotificationList items={data.slice(0, 6)} onRead={markRead} onNavigate={() => setOpen(false)} compact />
          </div>
          <Link
            to="/notificacoes"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand-600 transition-colors hover:bg-surface-2 dark:text-brand-300"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
