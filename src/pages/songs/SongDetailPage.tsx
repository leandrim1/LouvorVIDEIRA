import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Guitar,
  Headphones,
  Heart,
  History,
  Link2,
  ListMusic,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Save,
  ScrollText,
  Trash2,
  Video,
} from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { useRepertoire, useSong, useSongUsage } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle'
import { useMutation } from '@/hooks/useMutation'
import { formatDateShort, formatDayMonth } from '@/lib/dates'
import { extractChords, lyricsFromSheet, parseChordSheet, preferredNotation, semitonesBetween, transposeSheet } from '@/lib/music'
import { cn, pluralize } from '@/lib/utils'
import { historyService, preparationService, songService } from '@/services'
import type { SongWithRelations } from '@/types'
import {
  BackLink,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  KeyBadge,
  Modal,
  Skeleton,
  Tabs,
} from '@/components/ui'
import { KeySelector } from '@/components/songs/KeySelector'
import { MusicStatus } from '@/components/songs/MusicStatus'
import { SongChords } from '@/components/songs/SongChords'
import { SongCover } from '@/components/songs/SongCover'
import { SongLinks } from '@/components/songs/SongLinks'
import { SongLyrics } from '@/components/songs/SongLyrics'
import { SongNotes } from '@/components/songs/SongNotes'
import { SongPlayer } from '@/components/songs/SongPlayer'
import { VideoForm } from '@/components/songs/VideoForm'

type Tab = 'cifra' | 'letra' | 'videos' | 'links' | 'observacoes'

export default function SongDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const repertoireId = params.get('repertorio') ?? undefined
  const { data: song, error, isLoading, refetch } = useSong(id)
  const repertoire = useRepertoire(repertoireId)
  useDocumentTitle(song ? `${song.title} — ${song.artist}` : 'Música')

  if (error) {
    return (
      <div>
        <BackLink to="/musicas" label="Músicas" />
        <ErrorState title="Música não encontrada" error={error} onRetry={refetch} />
      </div>
    )
  }
  if (isLoading || !song || (repertoireId && repertoire.isLoading)) return <SongSkeleton />
  return <SongView key={`${song.id}-${repertoireId ?? ''}`} song={song} repertoire={repertoire.data ?? null} />
}

function SongView({ song, repertoire }: { song: SongWithRelations; repertoire: ReturnType<typeof useRepertoire>['data'] | null }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { user, member, can } = useSession()
  const { toggle, isFavorite } = useFavoriteToggle()
  const { data: usage } = useSongUsage()
  const [params, setParams] = useSearchParams()
  const [videoFormOpen, setVideoFormOpen] = useState(false)
  const [chordsOpen, setChordsOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  // Contexto de repertório: tom usado no culto + navegação anterior/próxima
  const repertoireIndex = repertoire ? repertoire.songs.findIndex((s) => s.songId === song.id) : -1
  const repertoireItem = repertoireIndex >= 0 ? repertoire!.songs[repertoireIndex] : null
  const baseKey = repertoireItem?.key ?? song.teamKey
  const [displayKey, setDisplayKey] = useState(baseKey)

  const tab = (params.get('aba') as Tab) || 'cifra'
  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('aba', next)
        return p
      },
      { replace: true },
    )

  // Abre direto na aba pedida (ex.: botão "Cifra" do repertório)
  useEffect(() => {
    if (params.get('aba')) tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Registra no histórico "Recentemente acessadas"
  useEffect(() => {
    if (user) void historyService.record(user.id, song.id).catch(() => undefined)
  }, [user, song.id])

  const chords = useMemo(() => {
    const lines = transposeSheet(parseChordSheet(song.chords), semitonesBetween(song.originalKey, displayKey), preferredNotation(displayKey))
    return extractChords(lines)
  }, [song.chords, song.originalKey, displayKey])

  const saveKey = useMutation(() => songService.setTeamKey(song.id, displayKey), {
    success: `Tom da equipe alterado para ${displayKey}`,
    error: 'Não foi possível alterar o tom',
  })
  const remove = useMutation(() => songService.remove(song.id), {
    success: 'Música excluída',
    onSuccess: () => navigate('/musicas', { replace: true }),
  })
  const removeVideo = useMutation((videoId: string) => songService.removeVideo(videoId), { success: 'Vídeo removido' })

  const listenLink =
    song.links.find((l) => l.type === 'spotify') ??
    song.links.find((l) => l.type === 'apple_music') ??
    song.links.find((l) => l.type === 'deezer') ??
    song.links.find((l) => l.type === 'youtube')
  const songUsage = usage?.[song.id]
  const lyrics = song.lyrics.trim() || lyricsFromSheet(song.chords)
  const favorite = isFavorite(song.id)

  const goToTab = (next: Tab) => {
    setTab(next)
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const onDelete = async () => {
    const used = songUsage?.count ?? 0
    const ok = await confirm({
      title: `Excluir "${song.title}"?`,
      description: used
        ? `Esta música está em ${pluralize(used, 'repertório')} e será removida deles. Vídeos, links e observações também serão excluídos.`
        : 'Vídeos, links e observações também serão excluídos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir música',
      danger: true,
    })
    if (ok) void remove.mutate()
  }

  const prev = repertoire && repertoireIndex > 0 ? repertoire.songs[repertoireIndex - 1] : null
  const next = repertoire && repertoireIndex >= 0 && repertoireIndex < repertoire.songs.length - 1 ? repertoire.songs[repertoireIndex + 1] : null
  const repertoireQuery = repertoire ? `?repertorio=${repertoire.id}${params.get('aba') ? `&aba=${params.get('aba')}` : ''}` : ''

  return (
    <div className="animate-fade-up">
      {repertoire ? (
        <BackLink to={`/repertorios/${repertoire.id}`} label="Voltar para o repertório" />
      ) : (
        <BackLink to="/musicas" label="Músicas" />
      )}

      {/* Barra de contexto do repertório */}
      {repertoire && repertoireItem && (
        <nav
          aria-label="Navegação no repertório"
          className="mb-4 flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 p-2 dark:border-brand-500/25 dark:bg-brand-500/[0.07]"
        >
          <IconButton
            label={prev ? `Anterior: ${prev.song.title}` : 'Sem música anterior'}
            size="icon"
            variant="ghost"
            disabled={!prev}
            onClick={() => prev && navigate(`/musicas/${prev.songId}${repertoireQuery}`)}
          >
            <ChevronLeft />
          </IconButton>
          <Link to={`/repertorios/${repertoire.id}`} className="min-w-0 flex-1 text-center">
            <span className="block truncate text-xs font-semibold text-brand-700 dark:text-brand-300">
              {repertoire.name} · {formatDayMonth(repertoire.event.date)}
            </span>
            <span className="block text-sm font-bold text-ink">
              Música {repertoireIndex + 1} de {repertoire.songs.length}
            </span>
          </Link>
          <IconButton
            label={next ? `Próxima: ${next.song.title}` : 'Sem próxima música'}
            size="icon"
            variant="ghost"
            disabled={!next}
            onClick={() => next && navigate(`/musicas/${next.songId}${repertoireQuery}`)}
          >
            <ChevronRight />
          </IconButton>
        </nav>
      )}

      {/* Cabeçalho */}
      <section className="mb-6 rounded-3xl border border-line bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <SongCover title={song.title} src={song.coverUrl} size="xl" className="self-center sm:self-start" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-ink sm:text-3xl">{song.title}</h1>
                <p className="mt-1 text-base font-medium text-ink-2">{song.artist}</p>
                {song.album && <p className="text-sm text-ink-3">{song.album}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton
                  label={favorite ? 'Remover dos favoritos' : 'Favoritar'}
                  aria-pressed={favorite}
                  onClick={() => void toggle(song.id, song.title)}
                  className={cn(favorite && 'text-rose-500 hover:text-rose-600')}
                >
                  <Heart className={cn(favorite && 'fill-current')} />
                </IconButton>
                {can('songs:write') && (
                  <Dropdown
                    trigger={({ toggle: t, ...aria }) => (
                      <IconButton label="Mais ações" onClick={t} {...aria}>
                        <MoreHorizontal />
                      </IconButton>
                    )}
                    items={[
                      { label: 'Editar música', icon: <Pencil />, href: `/musicas/${song.id}/editar` },
                      { label: 'Adicionar vídeo', icon: <Video />, onSelect: () => setVideoFormOpen(true) },
                      { label: 'Excluir música', icon: <Trash2 />, onSelect: () => void onDelete(), danger: true, separatorBefore: true, hidden: !can('songs:delete') },
                    ]}
                  />
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <KeyBadge value={baseKey} size="lg" label />
              {repertoireItem && repertoireItem.key !== song.teamKey && <Badge tone="info">Tom do repertório · equipe: {song.teamKey}</Badge>}
              {song.bpm && (
                <span className="inline-flex h-10 items-center rounded-lg bg-surface-2 px-3.5 text-sm font-semibold text-ink ring-1 ring-line">
                  <span className="mr-1.5 font-medium text-ink-3">BPM</span>
                  <span className="tabular">{song.bpm}</span>
                </span>
              )}
              {song.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            {repertoireItem?.leadVocal && (
              <p className="mt-3 text-sm text-ink-2">
                Vocal principal: <strong className="font-semibold text-ink">{repertoireItem.leadVocal.name}</strong>
                {repertoireItem.instrumentation && ` · ${repertoireItem.instrumentation}`}
              </p>
            )}
            {repertoireItem?.notes && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{repertoireItem.notes}</p>
            )}
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="scrollbar-none relative -mx-5 mt-5 flex gap-2 overflow-x-auto border-t border-line px-5 pt-5 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
          <QuickAction icon={<Play />} label="Assistir vídeo" onClick={() => goToTab('videos')} disabled={song.videos.length === 0} primary />
          <QuickAction
            icon={<Headphones />}
            label="Ouvir música"
            href={listenLink?.url}
            disabled={!listenLink}
          />
          <QuickAction icon={<FileText />} label="Ver cifra" onClick={() => goToTab('cifra')} disabled={!song.chords.trim()} />
          <QuickAction icon={<ScrollText />} label="Ver letra" onClick={() => goToTab('letra')} disabled={!lyrics} />
          <QuickAction icon={<Guitar />} label="Ver acordes" onClick={() => setChordsOpen(true)} disabled={chords.length === 0} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div ref={tabsRef} className="scroll-mt-20">
            <Tabs<Tab>
              label="Conteúdo da música"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'cifra', label: 'Cifra', icon: <FileText /> },
                { value: 'letra', label: 'Letra', icon: <ScrollText /> },
                { value: 'videos', label: 'Vídeos', icon: <Video />, count: song.videos.length },
                { value: 'links', label: 'Links', icon: <Link2 />, count: song.links.length },
                { value: 'observacoes', label: 'Observações', icon: <MessageSquare /> },
              ]}
            />
          </div>

          <div role="tabpanel" className="animate-fade-in">
            {tab === 'cifra' && (
              <SongChords
                sheet={song.chords}
                originalKey={song.originalKey}
                displayKey={displayKey}
                onKeyChange={setDisplayKey}
                title={song.title}
                subtitle={song.artist}
              />
            )}
            {tab === 'letra' && <SongLyrics lyrics={lyrics} title={song.title} subtitle={song.artist} />}
            {tab === 'videos' && (
              <div className="space-y-4">
                {song.videos.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Video />}
                    title="Nenhum vídeo cadastrado"
                    description="Adicione o vídeo oficial, de estudo ou do ensaio."
                    action={
                      can('songs:write') && (
                        <Button size="sm" leftIcon={<Plus />} onClick={() => setVideoFormOpen(true)}>
                          Adicionar vídeo
                        </Button>
                      )
                    }
                  />
                ) : (
                  <>
                    {song.videos.map((v) => (
                      <div key={v.id} className="relative">
                        <SongPlayer url={v.url} title={v.title} type={v.type} />
                        {can('songs:write') && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (await confirm({ title: 'Remover vídeo?', description: v.title, confirmLabel: 'Remover', danger: true })) void removeVideo.mutate(v.id)
                            }}
                            className="absolute top-2 right-2 z-10 flex size-9 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur transition-colors hover:bg-red-600"
                            aria-label={`Remover vídeo ${v.title}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {can('songs:write') && (
                      <Button variant="secondary" leftIcon={<Plus />} onClick={() => setVideoFormOpen(true)} className="w-full">
                        Adicionar vídeo
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
            {tab === 'links' && <SongLinks links={song.links} />}
            {tab === 'observacoes' && <SongNotes songId={song.id} generalNotes={song.notes} />}
          </div>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Tonalidade" description="Transponha a cifra com + e −" />
            <CardBody className="flex flex-col items-center gap-4">
              <KeySelector value={displayKey} onChange={setDisplayKey} referenceKey={song.originalKey} size="lg" />
              <div className="grid w-full grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-surface-2 p-2.5">
                  <p className="text-[11px] font-semibold text-ink-3">Tom original</p>
                  <p className="font-mono text-lg font-bold text-ink">{song.originalKey}</p>
                </div>
                <div className="rounded-xl bg-brand-50 p-2.5 dark:bg-brand-500/10">
                  <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">Tom da equipe</p>
                  <p className="font-mono text-lg font-bold text-brand-700 dark:text-brand-200">{song.teamKey}</p>
                </div>
              </div>
              {can('songs:write') && displayKey !== song.teamKey && (
                <Button variant="soft" size="sm" leftIcon={<Save />} onClick={() => void saveKey.mutate()} loading={saveKey.isPending} className="w-full">
                  Definir {displayKey} como tom da equipe
                </Button>
              )}
            </CardBody>
          </Card>

          {repertoireItem && member && (
            <Card>
              <CardHeader title="Minha preparação" description={repertoire?.name} />
              <CardBody>
                <MusicStatus
                  preparation={repertoireItem.preparation}
                  onChange={(patch) =>
                    void preparationService.update(repertoireItem.id, member.id, patch).catch(() => toast.error('Não foi possível salvar'))
                  }
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Informações" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
                <Info label="Tom original" value={song.originalKey} mono />
                <Info label="Tom da equipe" value={song.teamKey} mono />
                <Info label="BPM" value={song.bpm ? String(song.bpm) : '—'} />
                <Info label="Compasso" value={song.timeSignature || '—'} />
                <Info label="Capotraste" value={song.capo ? `${song.capo}ª casa` : 'Sem capo'} />
                <Info label="Afinação" value={song.tuning || 'Padrão'} />
                <Info label="Compositor" value={song.composer || '—'} className="col-span-2" />
                <Info label="Álbum" value={song.album || '—'} className="col-span-2" />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Histórico de uso" icon={<History />} />
            <CardBody className="pt-3">
              {!songUsage ? (
                <p className="text-sm text-ink-3">Ainda não utilizada em repertórios.</p>
              ) : (
                <>
                  <p className="text-sm text-ink-2">
                    Usada em <strong className="text-ink">{pluralize(songUsage.count, 'repertório')}</strong>
                    {songUsage.lastUsed && (
                      <>
                        {' '}
                        · última utilização: <strong className="text-ink">{formatDateShort(songUsage.lastUsed)}</strong>
                      </>
                    )}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {songUsage.repertoires.slice(0, 5).map((r) => (
                      <li key={r.id}>
                        <Link to={`/repertorios/${r.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2">
                          <ListMusic className="size-4 text-ink-3" aria-hidden />
                          <span className="tabular font-semibold text-ink">{formatDateShort(r.date)}</span>
                          <span className="truncate text-ink-3">{r.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>

      <Modal open={chordsOpen} onClose={() => setChordsOpen(false)} title="Acordes da música" description={`No tom ${displayKey} · ${chords.length} acordes`} size="sm">
        <div className="flex flex-wrap gap-2">
          {chords.map((c) => (
            <span key={c} className="rounded-xl bg-surface-2 px-3.5 py-2 font-mono text-lg font-bold text-chord ring-1 ring-line">
              {c}
            </span>
          ))}
        </div>
        <div className="mt-5">
          <KeySelector value={displayKey} onChange={setDisplayKey} referenceKey={song.originalKey} />
        </div>
      </Modal>

      <VideoForm open={videoFormOpen} onClose={() => setVideoFormOpen(false)} songId={song.id} />
    </div>
  )
}

function QuickAction({
  icon,
  label,
  onClick,
  href,
  disabled,
  primary,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  primary?: boolean
}) {
  const classes = cn(
    'flex min-w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-semibold transition-all active:scale-[0.97] [&_svg]:size-5',
    primary
      ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500'
      : 'bg-surface-2 text-ink ring-1 ring-line ring-inset hover:bg-surface-3',
    disabled && 'pointer-events-none opacity-40',
  )
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {icon}
        {label}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {icon}
      {label}
    </button>
  )
}

function Info({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className={cn('mt-0.5 font-semibold text-ink', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function SongSkeleton() {
  return (
    <div role="status" aria-label="Carregando música">
      <Skeleton className="mb-4 h-5 w-24" />
      <Skeleton className="mb-6 h-72 w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 w-full rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  )
}
