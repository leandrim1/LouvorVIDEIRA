import { Link } from 'react-router-dom'
import { MEMBER_ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { groupScheduleByRole } from '@/services'
import type { ScheduleDetail } from '@/types'
import { Avatar } from '@/components/ui'

interface ScheduleRosterProps {
  schedule: ScheduleDetail
  /** Destaca o integrante logado */
  highlightMemberId?: string | null
  variant?: 'cards' | 'list'
  className?: string
}

/** Escala agrupada por função — cada integrante em um card */
export function ScheduleRoster({ schedule, highlightMemberId, variant = 'cards', className }: ScheduleRosterProps) {
  const groups = groupScheduleByRole(schedule)
  if (groups.length === 0) return <p className="text-sm text-ink-3">Ninguém escalado ainda.</p>

  if (variant === 'list') {
    return (
      <dl className={cn('divide-y divide-line', className)}>
        {groups.map(({ role, members }) => (
          <div key={role} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-[13px] font-medium text-ink-3">{MEMBER_ROLE_LABELS[role]}</dt>
            <dd className="flex flex-wrap justify-end gap-x-1 text-right text-sm font-semibold text-ink">
              {members.map((m, i) => (
                <span key={m.id} className={cn(m.id === highlightMemberId && 'text-brand-600 dark:text-brand-300')}>
                  {m.name.split(' ')[0]}
                  {i < members.length - 1 && ','}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {groups.map(({ role, members }) => (
        <section key={role} className="rounded-2xl border border-line bg-surface p-3">
          <h4 className="mb-2 px-1 text-[11px] font-bold tracking-wider text-ink-3 uppercase">{MEMBER_ROLE_LABELS[role]}</h4>
          <ul className="space-y-1.5">
            {members.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/equipe?integrante=${m.id}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-surface-2',
                    m.id === highlightMemberId && 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30',
                  )}
                >
                  <Avatar name={m.name} src={m.photoUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                    {m.id === highlightMemberId && <span className="block text-[11px] font-semibold text-brand-600 dark:text-brand-300">Você</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
