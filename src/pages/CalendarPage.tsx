import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useEvents } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_TYPE_STYLES } from '@/lib/constants'
import { parseISODate, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { EventType } from '@/types'
import { Button, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { Calendar, type CalendarView } from '@/components/calendar/Calendar'
import { EventDrawer } from '@/components/events/EventDrawer'
import { EventForm } from '@/components/events/EventForm'

export default function CalendarPage() {
  useDocumentTitle('Calendário')
  const { can } = useSession()
  const { data: events = [], isLoading, error, refetch } = useEvents()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useLocalStorage<CalendarView>('calendar:view', 'month')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [hiddenTypes, setHiddenTypes] = useState<EventType[]>([])

  const openEventId = params.get('evento')
  const creating = params.get('novo') === '1'
  const openEvent = events.find((e) => e.id === openEventId) ?? null

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === 'novo' },
    )

  const visible = useMemo(() => events.filter((e) => !hiddenTypes.includes(e.type)), [events, hiddenTypes])

  // Ao abrir por link direto (?evento=), posiciona o calendário na data do evento
  const [syncedEvent, setSyncedEvent] = useState<string | null>(null)
  if (openEvent && syncedEvent !== openEvent.id) {
    setSyncedEvent(openEvent.id)
    setCursor(parseISODate(openEvent.date))
    setSelectedDate(openEvent.date)
  }

  const toggleType = (type: EventType) => setHiddenTypes((list) => (list.includes(type) ? list.filter((t) => t !== type) : [...list, type]))

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Calendário"
        description="Cultos, ensaios e eventos especiais. Toque em um evento para ver repertório e escala."
        actions={
          can('events:write') && (
            <Button leftIcon={<CalendarPlus />} onClick={() => setParam('novo', '1')}>
              Novo evento
            </Button>
          )
        }
      />

      <div className="scrollbar-none relative -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar tipos de evento">
        {EVENT_TYPES.map((type) => {
          const active = !hiddenTypes.includes(type)
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(type)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition-colors ring-inset',
                active ? 'bg-surface text-ink ring-line-strong' : 'bg-transparent text-ink-3 ring-line line-through',
              )}
            >
              <span className={cn('size-2 rounded-full', EVENT_TYPE_STYLES[type].dot, !active && 'opacity-40')} aria-hidden />
              {EVENT_TYPE_LABELS[type]}
            </button>
          )
        })}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div role="status" aria-label="Carregando calendário" className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-[480px] w-full rounded-2xl" />
        </div>
      ) : (
        <Calendar
          events={visible}
          view={view}
          onViewChange={setView}
          cursor={cursor}
          onCursorChange={setCursor}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenEvent={(e) => setParam('evento', e.id)}
        />
      )}

      {openEvent && <EventDrawer event={openEvent} onClose={() => setParam('evento', null)} />}
      <EventForm open={creating} onClose={() => setParam('novo', null)} defaultDate={selectedDate} onSaved={(e) => {
          setSelectedDate(e.date)
          setCursor(parseISODate(e.date))
        }} />
    </div>
  )
}
