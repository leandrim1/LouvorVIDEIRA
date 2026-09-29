import { useMemo, useState } from 'react'
import { useUrlState } from '@/hooks/useUrlState'
import { FilterX, ListMusic, ListPlus, SlidersHorizontal } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useRepertoires } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/lib/constants'
import {
  endOfMonth,
  endOfWeek,
  formatMonthYear,
  isUpcoming,
  monthNames,
  parseISODate,
  startOfMonth,
  startOfWeek,
  toISODate,
  weeksOfMonth,
} from '@/lib/dates'
import { matchesQuery } from '@/lib/utils'
import type { EventType, RepertoireSummary } from '@/types'
import {
  Button,
  ButtonLink,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SearchBar,
  SegmentedControl,
  Select,
  SkeletonList,
  Tabs,
} from '@/components/ui'
import { RepertoireCard } from '@/components/repertoires/RepertoireCard'
import { DISPLAY_STATUS_LABELS, repertoireDisplayStatus, type RepertoireDisplayStatus } from '@/lib/repertoire'

type Scope = 'upcoming' | 'week' | 'month' | 'past' | 'all'
type GroupBy = 'month' | 'event'

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: 'upcoming', label: 'Próximos' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'past', label: 'Anteriores' },
  { value: 'all', label: 'Todos' },
]

const FILTER_KEYS = ['ano', 'mes', 'semana', 'tipo', 'status', 'q'] as const

function inScope(r: RepertoireSummary, scope: Scope, now: Date) {
  const { date, startTime } = r.event
  switch (scope) {
    case 'upcoming':
      return isUpcoming(date, startTime, now)
    case 'past':
      return !isUpcoming(date, startTime, now)
    case 'week':
      return date >= toISODate(startOfWeek(now)) && date <= toISODate(endOfWeek(now))
    case 'month':
      return date >= toISODate(startOfMonth(now)) && date <= toISODate(endOfMonth(now))
    default:
      return true
  }
}

export default function RepertoiresPage() {
  useDocumentTitle('Repertórios')
  const { can } = useSession()
  const { data = [], isLoading, error, refetch } = useRepertoires()
  const [filters, setFilter, setFilters, resetFilters] = useUrlState({
    aba: 'upcoming',
    agrupar: 'month',
    ano: '',
    mes: '',
    semana: '',
    tipo: '',
    status: '',
    q: '',
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [now] = useState(() => new Date())

  const scope = filters.aba as Scope
  const groupBy = filters.agrupar as GroupBy
  const { ano: year, mes: month, semana: week, q: query } = filters
  const type = filters.tipo as EventType | ''
  const status = filters.status as RepertoireDisplayStatus | ''

  const setParam = (key: keyof typeof filters, value: string) => {
    if (key === 'ano' || key === 'mes') setFilters((f) => ({ ...f, [key]: value, semana: '' }))
    else setFilter(key, value)
  }

  const clearFilters = () => resetFilters([...FILTER_KEYS])

  const activeFilters = FILTER_KEYS.filter((k) => k !== 'q' && filters[k]).length

  const years = useMemo(() => {
    const set = new Set(data.map((r) => r.event.date.slice(0, 4)))
    set.add(String(now.getFullYear()))
    return [...set].sort()
  }, [data, now])

  const weeks = useMemo(() => {
    if (!month) return []
    const y = Number(year || now.getFullYear())
    return weeksOfMonth(y, Number(month))
  }, [year, month, now])

  const filtered = useMemo(() => {
    const list = data.filter((r) => {
      if (!inScope(r, scope, now)) return false
      const date = r.event.date
      if (year && !date.startsWith(year)) return false
      if (month && parseISODate(date).getMonth() !== Number(month)) return false
      if (week) {
        const [start, end] = week.split('|')
        if (date < start || date > end) return false
      }
      if (type && r.event.type !== type) return false
      if (status && repertoireDisplayStatus(r.status, r.event) !== status) return false
      if (query && !matchesQuery(query, r.name, r.description, r.songTitles.join(' '), r.event.location, date.split('-').reverse().join('/'))) return false
      return true
    })
    return scope === 'past' ? list.reverse() : list
  }, [data, scope, year, month, week, type, status, query, now])

  const groups = useMemo(() => {
    const map = new Map<string, RepertoireSummary[]>()
    for (const r of filtered) {
      const key = groupBy === 'event' ? EVENT_TYPE_LABELS[r.event.type] : formatMonthYear(parseISODate(r.event.date))
      map.set(key, [...(map.get(key) ?? []), r])
    }
    return [...map.entries()]
  }, [filtered, groupBy])

  const renderFilters = (prefix: string) => (
    <>
      <Field label="Ano" htmlFor={`${prefix}-year`}>
        <Select id={`${prefix}-year`} value={year} onChange={(e) => setParam('ano', e.target.value)} placeholder="Todos" options={years.map((y) => ({ value: y, label: y }))} />
      </Field>
      <Field label="Mês" htmlFor={`${prefix}-month`}>
        <Select
          id={`${prefix}-month`}
          value={month}
          onChange={(e) => setParam('mes', e.target.value)}
          placeholder="Todos"
          options={monthNames().map((m, i) => ({ value: String(i), label: m }))}
        />
      </Field>
      <Field label="Semana" htmlFor={`${prefix}-week`} hint={!month ? 'Selecione um mês' : undefined}>
        <Select
          id={`${prefix}-week`}
          value={week}
          disabled={!month}
          onChange={(e) => setParam('semana', e.target.value)}
          placeholder="Todas"
          options={weeks.map((w) => ({ value: `${w.start}|${w.end}`, label: w.label }))}
        />
      </Field>
      <Field label="Tipo de evento" htmlFor={`${prefix}-type`}>
        <Select
          id={`${prefix}-type`}
          value={type}
          onChange={(e) => setParam('tipo', e.target.value)}
          placeholder="Todos"
          options={EVENT_TYPES.filter((t) => t !== 'rehearsal').map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
        />
      </Field>
      <Field label="Status" htmlFor={`${prefix}-status`}>
        <Select
          id={`${prefix}-status`}
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          placeholder="Todos"
          options={Object.entries(DISPLAY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </Field>
    </>
  )

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Repertórios"
        description="Organize os repertórios por culto, semana, mês ou evento."
        actions={
          can('repertoires:write') && (
            <ButtonLink to="/repertorios/novo" leftIcon={<ListPlus />}>
              Novo repertório
            </ButtonLink>
          )
        }
      />

      <Tabs label="Período" items={SCOPES} value={scope} onChange={(v) => setParam('aba', v)} className="mb-4" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={query} onChange={(v) => setParam('q', v)} placeholder="Buscar por nome, música ou data…" className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="secondary" leftIcon={<SlidersHorizontal />} onClick={() => setFiltersOpen(true)} className="lg:hidden">
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
          <SegmentedControl<GroupBy>
            label="Agrupar por"
            value={groupBy}
            onChange={(v) => setParam('agrupar', v)}
            options={[
              { value: 'month', label: 'Por mês' },
              { value: 'event', label: 'Por evento' },
            ]}
          />
        </div>
      </div>

      <div className="mb-6 hidden items-end gap-3 rounded-2xl border border-line bg-surface p-4 lg:flex [&>*]:flex-1">
        {renderFilters('desk')}
        <Button variant="ghost" leftIcon={<FilterX />} onClick={clearFilters} disabled={!activeFilters} className="!flex-none">
          Limpar
        </Button>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="secondary" onClick={clearFilters} disabled={!activeFilters} className="flex-1">
              Limpar
            </Button>
            <Button onClick={() => setFiltersOpen(false)} className="flex-1">
              Ver {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">{renderFilters('mob')}</div>
      </Drawer>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ListMusic />}
          title={data.length === 0 ? 'Nenhum repertório criado' : 'Nenhum repertório encontrado'}
          description={data.length === 0 ? 'Crie o primeiro repertório da equipe.' : 'Ajuste o período ou os filtros para ver outros repertórios.'}
          action={
            <>
              {(activeFilters > 0 || query) && (
                <Button variant="secondary" leftIcon={<FilterX />} onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
              {scope !== 'all' && data.length > 0 && (
                <Button variant="secondary" onClick={() => setParam('aba', 'all')}>
                  Ver todos
                </Button>
              )}
              {can('repertoires:write') && (
                <ButtonLink to="/repertorios/novo" leftIcon={<ListPlus />}>
                  Novo repertório
                </ButtonLink>
              )}
            </>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([label, items]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-3 flex items-center gap-3 text-xs font-extrabold tracking-[0.14em] text-ink-3 uppercase">
                {label}
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="tabular font-semibold tracking-normal normal-case">{items.length}</span>
              </h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {items.map((r) => (
                  <RepertoireCard key={r.id} repertoire={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
