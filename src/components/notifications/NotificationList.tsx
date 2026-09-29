import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, KeyRound, ListMusic, Music2, UserCheck, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { timeAgo } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { NotificationType } from '@/types'
import type { NotificationView } from '@/services/notificationService'

const ICONS: Record<NotificationType, { icon: ReactNode; className: string }> = {
  repertoire: { icon: <ListMusic />, className: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300' },
  key_change: { icon: <KeyRound />, className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
  rehearsal: { icon: <CalendarClock />, className: 'bg-leaf-50 text-leaf-600 dark:bg-leaf-500/10 dark:text-leaf-300' },
  schedule: { icon: <UserCheck />, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
  song: { icon: <Music2 />, className: 'bg-indigo-50 text-grape-500 dark:bg-grape-500/15 dark:text-grape-400' },
  system: { icon: <Info />, className: 'bg-surface-2 text-ink-2' },
}

interface NotificationListProps {
  items: NotificationView[]
  onRead: (id: string) => void
  onNavigate?: () => void
  compact?: boolean
}

export function NotificationList({ items, onRead, onNavigate, compact }: NotificationListProps) {
  const navigate = useNavigate()
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-ink-3">
        <Bell className="size-6" aria-hidden />
        <p className="text-sm font-medium">Nenhuma notificação por aqui.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const style = ICONS[n.type]
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => {
                if (!n.read) onRead(n.id)
                if (n.link) {
                  navigate(n.link)
                  onNavigate?.()
                }
              }}
              className={cn(
                'flex w-full items-start gap-3 text-left transition-colors hover:bg-surface-2',
                compact ? 'px-4 py-3' : 'px-4 py-4 sm:px-5',
              )}
            >
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4', style.className)}>{style.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn('truncate text-sm text-ink', n.read ? 'font-medium' : 'font-bold')}>{n.title}</span>
                  {!n.read && <span className="size-2 shrink-0 rounded-full bg-brand-500" aria-label="Não lida" />}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{n.message}</span>
                <span className="mt-1 block text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
