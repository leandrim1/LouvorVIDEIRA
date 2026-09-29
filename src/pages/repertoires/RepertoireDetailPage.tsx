import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CalendarClock,
  ClipboardList,
  Clock,
  Copy,
  CopyPlus,
  Link2,
  ListMusic,
  MapPin,
  MessageSquareText,
  Mic2,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  Trash2,
} from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { useRepertoire } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMutation } from '@/hooks/useMutation'
import { EVENT_TYPE_LABELS } from '@/lib/constants'
import { formatDateLong, formatDayMonth, formatTimeRange, formatWeekday, isUpcoming, relativeDayLabel } from '@/lib/dates'
import { overallProgress } from '@/lib/preparation'
import { copyToClipboard, repertoireToText } from '@/lib/share'
import { pluralize } from '@/lib/utils'
import { preparationService, repertoireService } from '@/services'
import type { RepertoireSongDetail } from '@/types'
import {
  BackLink,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  PageHeader,
  ProgressBar,
  Skeleton,
  SkeletonList,
} from '@/components/ui'
import { EventTypeBadge } from '@/components/events/EventBits'
import { RepertoireStatusBadge } from '@/components/repertoires/RepertoireStatusBadge'
import { SetlistItem } from '@/components/repertoires/SetlistItem'
import { ScheduleRoster } from '@/components/schedules/ScheduleRoster'
import { SongPlayer } from '@/components/songs/SongPlayer'

export default function RepertoireDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { can, member } = useSession()
  const { data: repertoire, error, isLoading, refetch } = useRepertoire(id)
  const [videoItem, setVideoItem] = useState<RepertoireSongDetail | null>(null)
  useDocumentTitle(repertoire ? `${repertoire.name} · ${formatDayMonth(repertoire.event.date)}` : 'Repertório')

  const remove = useMutation(() => repertoireService.remove(id!), {
    success: 'Repertório excluído',
    error: 'Não foi possível excluir o repertório',
    onSuccess: () => navigate('/repertorios', { replace: true }),
  })
  const publish = useMutation(() => repertoireService.setStatus(id!, 'published'), { success: 'Repertório publicado para a equipe' })

  if (error) {
    return (
      <div>
        <PageHeader title="Repertório" back={{ to: '/repertorios', label: 'Repertórios' }} />
        <ErrorState title="Repertório não encontrado" error={error} onRetry={refetch} />
      </div>
    )
  }
  if (isLoading || !repertoire) return <DetailSkeleton />

  const { event } = repertoire
  const upcoming = isUpcoming(event.date, event.startTime)
  const progress = overallProgress(
    repertoire.songs.map((s) => s.preparation),
    repertoire.songs.length,
  )

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir repertório?',
      description: `"${repertoire.name}" de ${formatDayMonth(event.date)} será excluído. O evento continuará no calendário.`,
      confirmLabel: 'Excluir repertório',
      danger: true,
    })
    if (ok) void remove.mutate()
  }

  const shareUrl = window.location.href.split('?')[0]
  const copyText = async () => {
    const ok = await copyToClipboard(repertoireToText(repertoire, shareUrl))
    if (ok) toast.success('Repertório copiado', 'Cole no WhatsApp ou no grupo da equipe.')
    else toast.error('Não foi possível copiar')
  }
  const copyLink = async () => {
    const ok = await copyToClipboard(shareUrl)
    if (ok) toast.success('Link copiado')
    else toast.error('Não foi possível copiar o link')
  }
  const nativeShare = async () => {
    try {
      await navigator.share({ title: repertoire.name, text: repertoireToText(repertoire), url: shareUrl })
    } catch {
      /* cancelado pelo usuário */
    }
  }

  const updatePreparation = (item: RepertoireSongDetail) =>
    member
      ? (patch: Parameters<typeof preparationService.update>[2]) => {
          preparationService.update(item.id, member.id, patch).catch(() => toast.error('Não foi possível salvar sua preparação'))
        }
      : undefined

  return (
    <div className="animate-fade-up">
      <BackLink to="/repertorios" label="Repertórios" />

      {/* Cabeçalho do culto */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-xs sm:p-7">
        <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-brand-500/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <EventTypeBadge type={event.type} />
              <RepertoireStatusBadge status={repertoire.status} event={event} />
              {upcoming && <span className="text-xs font-semibold text-ink-3">{relativeDayLabel(event.date)}</span>}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-wide text-ink uppercase sm:text-3xl">{repertoire.name}</h1>
            <p className="mt-1 text-base font-bold tracking-wide text-ink-2 uppercase">
              {formatWeekday(event.date)} · {formatDateLong(event.date).replace(/ de \d{4}$/, '')}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
              <span className="tabular inline-flex items-center gap-1.5 text-lg font-bold text-ink">
                <Clock className="size-5 text-brand-600 dark:text-brand-300" aria-hidden /> {formatTimeRange(event.startTime, event.endTime)}
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-ink-3" aria-hidden /> {event.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <ListMusic className="size-4 text-ink-3" aria-hidden /> {pluralize(repertoire.songs.length, 'música')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can('repertoires:write') && repertoire.status === 'draft' && (
              <Button leftIcon={<Send />} onClick={() => void publish.mutate()} loading={publish.isPending}>
                Publicar
              </Button>
            )}
            {can('repertoires:write') && (
              <ButtonLink to={`/repertorios/novo?duplicar=${repertoire.id}`} variant="soft" leftIcon={<CopyPlus />} className="uppercase tracking-wide">
                Duplicar repertório
              </ButtonLink>
            )}
            <Dropdown
              trigger={({ toggle, ...aria }) => (
                <Button variant="secondary" leftIcon={<Share2 />} onClick={toggle} {...aria}>
                  Compartilhar
                </Button>
              )}
              items={[
                { label: 'Copiar texto (WhatsApp)', icon: <MessageSquareText />, onSelect: () => void copyText() },
                { label: 'Copiar link', icon: <Link2 />, onSelect: () => void copyLink() },
                { label: 'Compartilhar…', icon: <Share2 />, onSelect: () => void nativeShare(), hidden: typeof navigator.share !== 'function' },
              ]}
            />
            {can('repertoires:write') && (
              <Dropdown
                trigger={({ toggle, ...aria }) => (
                  <IconButton label="Mais ações" variant="secondary" onClick={toggle} {...aria}>
                    <MoreHorizontal />
                  </IconButton>
                )}
                items={[
                  { label: 'Editar repertório', icon: <Pencil />, href: `/repertorios/${repertoire.id}/editar` },
                  { label: 'Duplicar', icon: <Copy />, href: `/repertorios/novo?duplicar=${repertoire.id}` },
                  {
                    label: repertoire.schedule ? 'Editar escala' : 'Montar escala',
                    icon: <ClipboardList />,
                    href: repertoire.schedule ? `/escalas/${repertoire.schedule.id}/editar` : `/escalas/nova?evento=${event.id}`,
                    hidden: !can('schedules:write'),
                  },
                  { label: 'Agendar ensaio', icon: <Mic2 />, href: `/ensaios?novo=1&repertorio=${repertoire.id}`, hidden: !can('rehearsals:write') },
                  { label: 'Excluir repertório', icon: <Trash2 />, onSelect: () => void onDelete(), danger: true, separatorBefore: true },
                ]}
              />
            )}
          </div>
        </div>

        {(repertoire.description || repertoire.notes) && (
          <div className="relative mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
            {repertoire.description && (
              <div>
                <p className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Descrição</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{repertoire.description}</p>
              </div>
            )}
            {repertoire.notes && (
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
                <p className="text-[11px] font-bold tracking-wider text-amber-800 uppercase dark:text-amber-300">Observações</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-950 dark:text-amber-100">{repertoire.notes}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="setlist-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="setlist-title" className="text-xs font-extrabold tracking-[0.12em] text-ink-3 uppercase">
              Ordem do repertório
            </h2>
            {member && repertoire.songs.length > 0 && (
              <div className="w-32 shrink-0 sm:w-52">
                <ProgressBar value={progress} label="Sua preparação" showValue size="sm" />
              </div>
            )}
          </div>
          {repertoire.songs.length === 0 ? (
            <EmptyState
              icon={<ListMusic />}
              title="Nenhuma música neste repertório"
              action={
                can('repertoires:write') && (
                  <ButtonLink to={`/repertorios/${repertoire.id}/editar`} leftIcon={<Pencil />}>
                    Adicionar músicas
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ol className="space-y-3">
              {repertoire.songs.map((item, index) => (
                <SetlistItem
                  key={item.id}
                  item={item}
                  position={index + 1}
                  repertoireId={repertoire.id}
                  onPlayVideo={setVideoItem}
                  onPreparationChange={updatePreparation(item)}
                />
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader
              title="Escala"
              icon={<ClipboardList />}
              action={
                repertoire.schedule ? (
                  <ButtonLink to={`/escalas/${repertoire.schedule.id}`} variant="ghost" size="xs">
                    Ver
                  </ButtonLink>
                ) : undefined
              }
            />
            <CardBody className="pt-2">
              {repertoire.schedule ? (
                <ScheduleRoster schedule={repertoire.schedule} variant="list" highlightMemberId={member?.id} />
              ) : (
                <div className="py-2 text-center">
                  <p className="text-sm text-ink-3">Escala ainda não definida.</p>
                  {can('schedules:write') && (
                    <ButtonLink to={`/escalas/nova?evento=${event.id}`} size="sm" variant="soft" className="mt-3">
                      Montar escala
                    </ButtonLink>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ensaios" icon={<Mic2 />} />
            <CardBody className="pt-2">
              {repertoire.rehearsals.length === 0 ? (
                <div className="py-2 text-center">
                  <p className="text-sm text-ink-3">Nenhum ensaio agendado.</p>
                  {can('rehearsals:write') && (
                    <ButtonLink to={`/ensaios?novo=1&repertorio=${repertoire.id}`} size="sm" variant="soft" className="mt-3">
                      Agendar ensaio
                    </ButtonLink>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {repertoire.rehearsals.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                      <CalendarClock className="size-5 shrink-0 text-leaf-500" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {r.event.title} · {formatDayMonth(r.event.date)}
                        </p>
                        <p className="truncate text-xs text-ink-3">
                          {formatTimeRange(r.event.startTime, r.event.endTime)} · {r.event.location}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <p className="text-center text-xs text-ink-3">
            {EVENT_TYPE_LABELS[event.type]} · atualizado em {new Date(repertoire.updatedAt).toLocaleDateString('pt-BR')}
          </p>
        </aside>
      </div>

      <Modal
        open={videoItem !== null}
        onClose={() => setVideoItem(null)}
        size="lg"
        title={videoItem?.song.title ?? 'Vídeo'}
        description={videoItem ? `${videoItem.song.artist} · Tom ${videoItem.key}` : undefined}
      >
        {videoItem && (
          <div className="space-y-4">
            {videoItem.videos.map((v) => (
              <SongPlayer key={v.id} url={v.url} title={v.title} type={v.type} />
            ))}
            <Button variant="secondary" className="w-full" onClick={() => navigate(`/musicas/${videoItem.song.id}?repertorio=${repertoire.id}`)}>
              Abrir página da música
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando repertório">
      <Skeleton className="mb-4 h-5 w-28" />
      <Skeleton className="mb-6 h-56 w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonList count={4} className="lg:col-span-2" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  )
}
