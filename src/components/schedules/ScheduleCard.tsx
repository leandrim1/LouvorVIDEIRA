import { Link } from 'react-router-dom'
import { ChevronRight, Clock, Star } from 'lucide-react'
import { MEMBER_ROLE_LABELS } from '@/lib/constants'
import { formatDateShort, formatTime, isPast } from '@/lib/dates'
import { cn, pluralize, uniqueBy } from '@/lib/utils'
import type { ScheduleDetail } from '@/types'
import { AvatarGroup, Badge } from '@/components/ui'
import { DateBlock, EventTypeBadge } from '@/components/events/EventBits'

interface ScheduleCardProps {
  schedule: ScheduleDetail
  memberId?: string | null
}

export function ScheduleCard({ schedule, memberId }: ScheduleCardProps) {
  const people = uniqueBy(
    schedule.members.map((m) => m.member),
    (m) => m.id,
  )
  const leader = schedule.members.find((m) => m.role === 'leader')?.member
  const myRoles = schedule.members.filter((m) => m.memberId === memberId).map((m) => MEMBER_ROLE_LABELS[m.role])
  const past = isPast(schedule.event.date, schedule.event.startTime)

  return (
    <Link
      to={`/escalas/${schedule.id}`}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs transition-all hover:border-line-strong hover:shadow-md',
        past && 'opacity-70',
      )}
    >
      <DateBlock date={schedule.event.date} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold tracking-wide text-ink-3 uppercase">
            {schedule.event.title} — {formatDateShort(schedule.event.date)}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <span className="tabular inline-flex items-center gap-1 text-ink-3">
            <Clock className="size-3.5" aria-hidden /> {formatTime(schedule.event.startTime)}
          </span>
          {leader && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 text-amber-500" aria-hidden /> Líder: <strong className="font-semibold text-ink">{leader.name}</strong>
            </span>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <AvatarGroup people={people} max={6} size="xs" />
          <span className="text-xs text-ink-3">{pluralize(people.length, 'integrante')}</span>
          <EventTypeBadge type={schedule.event.type} className="hidden sm:inline-flex" />
          {myRoles.length > 0 && <Badge tone="brand">Você: {myRoles.join(', ')}</Badge>}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
