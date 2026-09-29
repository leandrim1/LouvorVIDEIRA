import { useMemo } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Rows3 } from 'lucide-react'
import { EVENT_TYPE_STYLES } from '@/lib/constants'
import {
  WEEKDAY_INITIALS,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  endOfMonth,
  formatDateWithWeekday,
  formatDayMonth,
  formatMonthYear,
  formatTime,
  monthMatrix,
  startOfMonth,
  startOfWeek,
  toISODate,
  todayISO,
} from '@/lib/dates'
import { cn, groupBy } from '@/lib/utils'
import type { EventDetail } from '@/types'
import { Button, EmptyState, IconButton, SegmentedControl } from '@/components/ui'
import { EventCard } from '@/components/events/EventCard'

export type CalendarView = 'month' | 'week' | 'list'

interface CalendarProps {
  events: EventDetail[]
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  cursor: Date
  onCursorChange: (date: Date) => void
  selectedDate: string
  onSelectDate: (date: string) => void
  onOpenEvent: (event: EventDetail) => void
}

function EventChip({ event, onOpen }: { event: EventDetail; onOpen: (e: EventDetail) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(event)
      }}
      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-ink transition-colors hover:bg-surface-3"
      title={`${formatTime(event.startTime)} · ${event.title}`}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', EVENT_TYPE_STYLES[event.type].dot)} aria-hidden />
      <span className="tabular shrink-0 text-ink-3">{formatTime(event.startTime)}</span>
      <span className="truncate">{event.title}</span>
    </button>
  )
}

/** Calendário com visualização mensal, semanal e em lista */
export function Calendar({ events, view, onViewChange, cursor, onCursorChange, selectedDate, onSelectDate, onOpenEvent }: CalendarProps) {
  const byDate = useMemo(() => groupBy(events, (e) => e.date), [events])
  const today = todayISO()

  const move = (direction: 1 | -1) => {
    if (view === 'week') onCursorChange(addDays(cursor, 7 * direction))
    else onCursorChange(addMonths(cursor, direction))
  }
  const goToday = () => {
    onCursorChange(new Date())
    onSelectDate(today)
  }

  const weekStart = startOfWeek(cursor)
  const title =
    view === 'week'
      ? `${formatDayMonth(toISODate(weekStart))} – ${formatDayMonth(toISODate(addDays(weekStart, 6)))}`
      : formatMonthYear(cursor)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconButton label={view === 'week' ? 'Semana anterior' : 'Mês anterior'} variant="secondary" size="icon-sm" onClick={() => move(-1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton label={view === 'week' ? 'Próxima semana' : 'Próximo mês'} variant="secondary" size="icon-sm" onClick={() => move(1)}>
            <ChevronRight />
          </IconButton>
          <h2 className="ml-1 text-lg font-extrabold tracking-tight text-ink" aria-live="polite">
            {title}
          </h2>
          <Button variant="ghost" size="xs" onClick={goToday} className="ml-1">
            Hoje
          </Button>
        </div>
        <SegmentedControl<CalendarView>
          label="Visualização do calendário"
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'month', label: 'Mensal', icon: <LayoutGrid /> },
            { value: 'week', label: 'Semanal', icon: <Rows3 /> },
            { value: 'list', label: 'Lista', icon: <List /> },
          ]}
        />
      </div>

      {view === 'month' && (
        <MonthView
          cursor={cursor}
          byDate={byDate}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onOpenEvent={onOpenEvent}
        />
      )}
      {view === 'week' && <WeekView weekStart={weekStart} byDate={byDate} today={today} onOpenEvent={onOpenEvent} />}
      {view === 'list' && <ListView cursor={cursor} events={events} today={today} onOpenEvent={onOpenEvent} />}
    </div>
  )
}

interface MonthViewProps {
  cursor: Date
  byDate: Record<string, EventDetail[]>
  today: string
  selectedDate: string
  onSelectDate: (date: string) => void
  onOpenEvent: (event: EventDetail) => void
}

function MonthView({ cursor, byDate, today, selectedDate, onSelectDate, onOpenEvent }: MonthViewProps) {
  const days = monthMatrix(cursor.getFullYear(), cursor.getMonth())
  const selectedEvents = byDate[selectedDate] ?? []

  return (
    <div className="grid gap-5 lg:grid-cols-1">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface" role="grid" aria-label={formatMonthYear(cursor)}>
        <div className="grid grid-cols-7 border-b border-line bg-surface-2/60" role="row">
          {WEEKDAY_SHORT.map((d, i) => (
            <div key={d} role="columnheader" className="py-2 text-center text-[11px] font-bold tracking-wide text-ink-3 uppercase">
              <span className="sm:hidden">{WEEKDAY_INITIALS[i]}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const iso = toISODate(day)
            const inMonth = day.getMonth() === cursor.getMonth()
            const dayEvents = byDate[iso] ?? []
            const isSelected = iso === selectedDate
            const isTodayCell = iso === today
            return (
              <div
                key={iso}
                role="gridcell"
                aria-selected={isSelected}
                onClick={() => onSelectDate(iso)}
                className={cn(
                  'relative min-h-14 cursor-pointer border-line p-1 transition-colors sm:min-h-28 sm:p-1.5',
                  i % 7 !== 6 && 'border-r',
                  i < 35 && 'border-b',
                  !inMonth && 'bg-surface-2/50',
                  isSelected ? 'bg-brand-50/70 dark:bg-brand-500/[0.07]' : 'hover:bg-surface-2/60',
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectDate(iso)
                  }}
                  aria-label={`${formatDateWithWeekday(iso)}${dayEvents.length ? `, ${dayEvents.length} evento(s)` : ''}`}
                  className={cn(
                    'tabular mx-auto flex size-7 items-center justify-center rounded-full text-[13px] font-semibold sm:mx-0',
                    isTodayCell ? 'bg-brand-600 text-white dark:bg-brand-600' : inMonth ? 'text-ink' : 'text-ink-3',
                    isSelected && !isTodayCell && 'ring-2 ring-brand-500',
                  )}
                >
                  {day.getDate()}
                </button>
                {/* Celular: pontos */}
                <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn('size-1.5 rounded-full', EVENT_TYPE_STYLES[e.type].dot)} />
                  ))}
                </div>
                {/* Desktop: chips */}
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {dayEvents.slice(0, 3).map((e) => (
                    <EventChip key={e.id} event={e} onOpen={onOpenEvent} />
                  ))}
                  {dayEvents.length > 3 && <p className="px-1.5 text-[11px] font-semibold text-ink-3">+{dayEvents.length - 3} mais</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <section aria-live="polite">
        <h3 className="mb-3 text-sm font-bold text-ink">{formatDateWithWeekday(selectedDate)}</h3>
        {selectedEvents.length === 0 ? (
          <EmptyState compact icon={<CalendarDays />} title="Nenhum evento neste dia" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {selectedEvents.map((e) => (
              <EventCard key={e.id} event={e} onOpen={onOpenEvent} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function WeekView({
  weekStart,
  byDate,
  today,
  onOpenEvent,
}: {
  weekStart: Date
  byDate: Record<string, EventDetail[]>
  today: string
  onOpenEvent: (event: EventDetail) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return (
    <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
      {days.map((day, i) => {
        const iso = toISODate(day)
        const dayEvents = byDate[iso] ?? []
        const isTodayCell = iso === today
        return (
          <section
            key={iso}
            className={cn(
              'rounded-2xl border bg-surface p-3 lg:min-h-64 lg:p-2',
              isTodayCell ? 'border-brand-400 ring-1 ring-brand-400/40' : 'border-line',
            )}
          >
            <header className="mb-2 flex items-center gap-2 lg:flex-col lg:items-start lg:gap-0">
              <span className="text-[11px] font-bold tracking-wide text-ink-3 uppercase">{WEEKDAY_SHORT[i]}</span>
              <span className={cn('tabular text-lg font-extrabold', isTodayCell ? 'text-brand-600 dark:text-brand-300' : 'text-ink')}>
                {day.getDate()}
              </span>
            </header>
            {dayEvents.length === 0 ? (
              <p className="text-xs text-ink-3">—</p>
            ) : (
              <div className="space-y-1.5">
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpenEvent(e)}
                    className={cn(
                      'w-full rounded-xl border-l-4 bg-surface-2 p-2 text-left transition-colors hover:bg-surface-3',
                      EVENT_TYPE_STYLES[e.type].bar,
                    )}
                  >
                    <p className="tabular text-[11px] font-semibold text-ink-3">{formatTime(e.startTime)}</p>
                    <p className="text-[13px] leading-snug font-bold text-ink">{e.title}</p>
                    {e.repertoire && <p className="mt-0.5 text-[11px] text-ink-3">{e.repertoire.songCount} músicas</p>}
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ListView({ cursor, events, today, onOpenEvent }: { cursor: Date; events: EventDetail[]; today: string; onOpenEvent: (event: EventDetail) => void }) {
  const start = toISODate(startOfMonth(cursor))
  const end = toISODate(endOfMonth(cursor))
  const monthEvents = events.filter((e) => e.date >= start && e.date <= end)
  const groups = groupBy(monthEvents, (e) => e.date)
  const dates = Object.keys(groups).sort()

  if (dates.length === 0) {
    return <EmptyState icon={<CalendarDays />} title="Nenhum evento neste mês" description="Use as setas para navegar entre os meses." />
  }
  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <section key={date}>
          <h3
            className={cn(
              'mb-2 text-sm font-bold',
              date === today ? 'text-brand-600 dark:text-brand-300' : 'text-ink',
            )}
          >
            {formatDateWithWeekday(date)}
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {groups[date].map((e) => (
              <EventCard key={e.id} event={e} onOpen={onOpenEvent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
