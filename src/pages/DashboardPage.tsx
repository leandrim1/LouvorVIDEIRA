import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  ListMusic,
  ListPlus,
  MapPin,
  Mic2,
  Music2,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useDashboard } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { EVENT_TYPE_LABELS, MEMBER_ROLE_LABELS } from '@/lib/constants'
import {
  formatDateWithWeekday,
  formatDay,
  formatDayMonth,
  formatMonthShort,
  formatTime,
  formatTimeRange,
  formatWeekday,
  formatWeekdayShort,
  greeting,
  relativeDayLabel,
  todayISO,
} from '@/lib/dates'
import { overallProgress } from '@/lib/preparation'
import { cn, firstName, pluralize } from '@/lib/utils'
import type { EventDetail, RepertoireDetail } from '@/types'
import type { DashboardData } from '@/services/dashboardService'
import { ButtonLink, Card, CardBody, CardHeader, EmptyState, ErrorState, ProgressRing, Skeleton, SkeletonList } from '@/components/ui'
import { EventCard } from '@/components/events/EventCard'
import { EventTypeBadge } from '@/components/events/EventBits'
import { SongCard } from '@/components/songs/SongCard'

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useSession()
  const { data, error, isLoading, refetch } = useDashboard()

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <p className="text-sm font-medium text-ink-3">{formatDateWithWeekday(todayISO())}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
          {greeting()}
          {user ? `, ${firstName(user.name)}` : ''}
        </h1>
      </header>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardContent data={data} />
      )}
    </div>
  )
}

function DashboardContent({ data }: { data: DashboardData }) {
  const { can } = useSession()
  const { nextService, nextRepertoire } = data

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {nextService ? (
          <NextServiceHero event={nextService} repertoire={nextRepertoire} />
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title="Nenhum culto agendado"
            description="Crie o próximo repertório para a equipe se preparar."
            action={
              can('repertoires:write') && (
                <ButtonLink to="/repertorios/novo" leftIcon={<ListPlus />}>
                  Criar repertório
                </ButtonLink>
              )
            }
          />
        )}

        {nextRepertoire && <WeekSetlist repertoire={nextRepertoire} />}
      </div>

      <aside className="space-y-6" aria-label="Resumo">
        {nextRepertoire && <PreparationCard repertoire={nextRepertoire} />}
        <MySchedulesCard items={data.mySchedules} />
        <NextRehearsalCard event={data.nextRehearsal} />
        <StatsCard stats={data.stats} />
      </aside>

      <div className="lg:col-span-3">
        <UpcomingEvents events={data.upcomingEvents} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SoundWave() {
  const bars = [30, 55, 80, 45, 95, 65, 40, 75, 100, 60, 35, 70, 50, 85, 45, 25]
  return (
    <div className="pointer-events-none absolute right-5 bottom-5 hidden h-24 items-end gap-1.5 opacity-25 sm:flex" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className="w-1.5 rounded-full bg-white" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

function NextServiceHero({ event, repertoire }: { event: EventDetail; repertoire: RepertoireDetail | null }) {
  const leader = event.schedule?.members.find((m) => m.role === 'leader')?.member
  const relative = relativeDayLabel(event.date)
  return (
    <section
      aria-labelledby="next-service-title"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-leaf-700 via-brand-700 to-grape-800 p-5 text-white shadow-xl shadow-brand-900/20 sm:p-7"
    >
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <SoundWave />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase backdrop-blur">
            <Sparkles className="size-3.5" aria-hidden /> Próximo culto
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">{relative}</span>
        </div>

        <div className="mt-5 flex items-end gap-5">
          <div>
            <p className="text-sm font-bold tracking-[0.25em] text-white/70 uppercase">{formatWeekday(event.date)}</p>
            <p className="mt-1 flex items-baseline gap-2 leading-none">
              <span className="tabular text-5xl font-extrabold tracking-tight sm:text-6xl">{formatDay(event.date)}</span>
              <span className="text-2xl font-extrabold tracking-wide text-white/85 sm:text-3xl">{formatMonthShort(event.date)}</span>
            </p>
          </div>
          <div className="mb-0.5 border-l border-white/20 pl-5">
            <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">Horário</p>
            <p className="tabular text-2xl font-bold sm:text-3xl">{formatTime(event.startTime)}</p>
          </div>
        </div>

        <h2 id="next-service-title" className="mt-5 text-xl font-extrabold tracking-wide uppercase sm:text-2xl">
          {event.title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden /> {EVENT_TYPE_LABELS[event.type]}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {event.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Music2 className="size-4" aria-hidden /> {pluralize(repertoire?.songs.length ?? event.repertoire?.songCount ?? 0, 'música')}
          </span>
          {leader && (
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-4" aria-hidden /> Líder: {leader.name}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {event.repertoire ? (
            <Link
              to={`/repertorios/${event.repertoire.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-bold text-brand-800 shadow-lg transition-transform hover:bg-brand-50 active:scale-[0.97]"
            >
              Ver repertório <ArrowRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <Link
              to={`/repertorios/novo?evento=${event.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-bold text-brand-800 shadow-lg transition-transform active:scale-[0.97]"
            >
              <ListPlus className="size-5" aria-hidden /> Criar repertório
            </Link>
          )}
          {event.schedule && (
            <Link
              to={`/escalas/${event.schedule.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-5 text-[15px] font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors ring-inset hover:bg-white/20"
            >
              <Users className="size-5" aria-hidden /> Escala
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

function WeekSetlist({ repertoire }: { repertoire: RepertoireDetail }) {
  return (
    <section aria-labelledby="week-setlist">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="week-setlist" className="text-[17px] font-bold tracking-tight text-ink">
            Repertório da semana
          </h2>
          <p className="text-[13px] text-ink-3">
            {repertoire.name} · {formatDayMonth(repertoire.event.date)} às {formatTime(repertoire.event.startTime)}
          </p>
        </div>
        <Link to={`/repertorios/${repertoire.id}`} className="shrink-0 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
          Ver tudo
        </Link>
      </div>
      {repertoire.songs.length === 0 ? (
        <EmptyState compact icon={<ListMusic />} title="Repertório sem músicas" description="Adicione músicas ao repertório." />
      ) : (
        <ol className="space-y-2.5">
          {repertoire.songs.map((item, index) => (
            <li key={item.id} className="animate-fade-up" style={{ animationDelay: `${index * 40}ms` }}>
              <SongCard
                song={item.song}
                href={`/musicas/${item.song.id}?repertorio=${repertoire.id}`}
                position={index + 1}
                keyOverride={item.key}
                leadVocal={item.leadVocal}
                instrumentation={item.instrumentation}
                preparation={item.preparation}
                showStatus
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function PreparationCard({ repertoire }: { repertoire: RepertoireDetail }) {
  const navigate = useNavigate()
  const percent = overallProgress(
    repertoire.songs.map((s) => s.preparation),
    repertoire.songs.length,
  )
  const ready = repertoire.songs.filter((s) => s.preparation?.status === 'ready').length
  const next = repertoire.songs.find((s) => s.preparation?.status !== 'ready')

  return (
    <Card>
      <CardHeader title="Sua preparação" description={repertoire.name} icon={<Sparkles />} />
      <CardBody className="flex items-center gap-4">
        <ProgressRing value={percent} size={72} stroke={6} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {ready} de {repertoire.songs.length} músicas prontas
          </p>
          {next ? (
            <button
              type="button"
              onClick={() => navigate(`/musicas/${next.song.id}?repertorio=${repertoire.id}`)}
              className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-[13px] font-semibold text-brand-600 hover:underline dark:text-brand-300"
            >
              <span className="truncate">Estudar “{next.song.title}”</span> <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            </button>
          ) : (
            <p className="mt-1 text-[13px] text-emerald-600 dark:text-emerald-400">Tudo pronto para o culto!</p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function MySchedulesCard({ items }: { items: DashboardData['mySchedules'] }) {
  return (
    <Card>
      <CardHeader title="Sua escala" description="Próximos compromissos" icon={<ClipboardList />} />
      <CardBody className="pt-3">
        {items.length === 0 ? (
          <p className="text-sm text-ink-3">Você não está escalado nos próximos eventos.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(({ event, roles }) => (
              <li key={event.id}>
                <Link
                  to={event.schedule ? `/escalas/${event.schedule.id}` : '/escalas'}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2"
                >
                  <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 ring-1 ring-line">
                    <span className="text-[9px] font-bold text-ink-3 uppercase">{formatWeekdayShort(event.date)}</span>
                    <span className="tabular text-base leading-none font-extrabold text-ink">{formatDay(event.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{event.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {formatTime(event.startTime)} · {roles.map((r) => MEMBER_ROLE_LABELS[r]).join(', ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

function NextRehearsalCard({ event }: { event: EventDetail | null }) {
  return (
    <Card>
      <CardHeader
        title="Próximo ensaio"
        icon={<Mic2 />}
        action={
          <Link to="/ensaios" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
            Ver todos
          </Link>
        }
      />
      <CardBody className="pt-3">
        {!event ? (
          <p className="text-sm text-ink-3">Nenhum ensaio agendado.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-600 dark:bg-leaf-500/10 dark:text-leaf-300">
                <CalendarClock className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">
                  {relativeDayLabel(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
                </p>
                <p className="truncate text-xs text-ink-3">
                  {formatWeekday(event.date)}, {formatDayMonth(event.date)} · {event.location}
                </p>
              </div>
            </div>
            {event.repertoire && (
              <Link
                to={`/repertorios/${event.repertoire.id}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm transition-colors hover:bg-surface-3"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-ink-3">Repertório</span>
                  <span className="block truncate font-semibold text-ink">{event.repertoire.name}</span>
                </span>
                <span className="tabular shrink-0 text-xs font-semibold text-ink-2">{pluralize(event.repertoire.songCount, 'música')}</span>
              </Link>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function StatsCard({ stats }: { stats: DashboardData['stats'] }) {
  const items = [
    { label: 'Músicas', value: stats.songs, to: '/musicas', icon: <Music2 /> },
    { label: 'Próx. repertórios', value: stats.upcomingRepertoires, to: '/repertorios', icon: <ListMusic /> },
    { label: 'Integrantes', value: stats.members, to: '/equipe', icon: <Users /> },
    { label: 'Próx. eventos', value: stats.upcomingEvents, to: '/calendario', icon: <CalendarDays /> },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="rounded-2xl border border-line bg-surface p-3.5 shadow-xs transition-all hover:border-line-strong hover:shadow-md"
        >
          <span className="text-ink-3 [&_svg]:size-4">{item.icon}</span>
          <p className="tabular mt-2 text-2xl font-extrabold tracking-tight text-ink">{item.value}</p>
          <p className="text-xs font-medium text-ink-3">{item.label}</p>
        </Link>
      ))}
    </div>
  )
}

function UpcomingEvents({ events }: { events: EventDetail[] }) {
  const navigate = useNavigate()
  const open = (e: EventDetail) => navigate(e.repertoire && e.type !== 'rehearsal' ? `/repertorios/${e.repertoire.id}` : `/calendario?evento=${e.id}`)

  return (
    <section aria-labelledby="upcoming-events">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="upcoming-events" className="text-[17px] font-bold tracking-tight text-ink">
          Próximos eventos
        </h2>
        <Link to="/calendario" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
          Calendário
        </Link>
      </div>
      {events.length === 0 ? (
        <EmptyState compact icon={<CalendarDays />} title="Nenhum evento futuro" />
      ) : (
        <>
          {/* Celular: cards */}
          <div className="space-y-2.5 md:hidden">
            {events.map((e) => (
              <EventCard key={e.id} event={e} onOpen={open} />
            ))}
          </div>
          {/* Tablet/desktop: tabela */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs font-semibold text-ink-3">
                <tr>
                  <th scope="col" className="px-5 py-3">Data</th>
                  <th scope="col" className="px-5 py-3">Horário</th>
                  <th scope="col" className="px-5 py-3">Evento</th>
                  <th scope="col" className="px-5 py-3">Repertório</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e.id} onClick={() => open(e)} className="cursor-pointer transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="tabular font-semibold text-ink">{formatDayMonth(e.date)}</span>
                      <span className="ml-2 text-ink-3">{formatWeekdayShort(e.date)}</span>
                    </td>
                    <td className="tabular px-5 py-3.5 whitespace-nowrap text-ink-2">
                      <Clock className="mr-1.5 inline size-3.5 text-ink-3" aria-hidden />
                      {formatTime(e.startTime)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            open(e)
                          }}
                          className="font-semibold text-ink hover:text-brand-600 dark:hover:text-brand-300"
                        >
                          {e.title}
                        </button>
                        <EventTypeBadge type={e.type} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {e.repertoire ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <ListMusic className="size-4 text-ink-3" aria-hidden />
                          {e.type === 'rehearsal' ? e.repertoire.name : pluralize(e.repertoire.songCount, 'música')}
                        </span>
                      ) : (
                        <span className={cn('text-ink-3 italic')}>Sem repertório</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Carregando dashboard">
      <div className="space-y-6 lg:col-span-2">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <SkeletonList count={4} />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  )
}
