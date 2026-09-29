import { useMemo } from 'react'
import { useUrlState } from '@/hooks/useUrlState'
import { FilterX, Heart, LayoutGrid, List, Music, Music2, Plus } from 'lucide-react'
import { useSession } from '@/contexts/session'
import { useSongUsage, useSongs } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatDateShort } from '@/lib/dates'
import { cn, matchesQuery, pluralize } from '@/lib/utils'
import { Button, ButtonLink, EmptyState, ErrorState, KeyBadge, PageHeader, SearchBar, SegmentedControl, Select, SkeletonGrid } from '@/components/ui'
import { SongCard } from '@/components/songs/SongCard'
import { SongCover } from '@/components/songs/SongCover'
import { Link } from 'react-router-dom'

type Sort = 'title' | 'recent' | 'most_used' | 'last_used'

export default function SongsPage() {
  useDocumentTitle('Músicas')
  const { can } = useSession()
  const { data: songs = [], isLoading, error, refetch } = useSongs()
  const { data: usage = {} } = useSongUsage()
  const { toggle, isFavorite } = useFavoriteToggle()
  const [filters, setParam, , resetFilters] = useUrlState({ q: '', tom: '', artista: '', ordem: 'title', favoritas: '' })
  const [view, setView] = useLocalStorage<'grid' | 'list'>('songs:view', 'grid')

  const { q: query, tom: key, artista: artist } = filters
  const sort = filters.ordem as Sort
  const onlyFavorites = filters.favoritas === '1'
  const clearFilters = () => resetFilters(['q', 'tom', 'artista', 'favoritas'])

  const keys = useMemo(() => [...new Set(songs.map((s) => s.teamKey))].sort(), [songs])
  const artists = useMemo(() => [...new Set(songs.map((s) => s.artist))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [songs])

  const filtered = useMemo(() => {
    const list = songs.filter(
      (s) =>
        matchesQuery(query, s.title, s.artist, s.album, s.composer, s.tags.join(' ')) &&
        (!key || s.teamKey === key) &&
        (!artist || s.artist === artist) &&
        (!onlyFavorites || isFavorite(s.id)),
    )
    const byTitle = (a: (typeof list)[number], b: (typeof list)[number]) => a.title.localeCompare(b.title, 'pt-BR')
    switch (sort) {
      case 'recent':
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      case 'most_used':
        return list.sort((a, b) => (usage[b.id]?.count ?? 0) - (usage[a.id]?.count ?? 0) || byTitle(a, b))
      case 'last_used':
        return list.sort((a, b) => (usage[b.id]?.lastUsed ?? '').localeCompare(usage[a.id]?.lastUsed ?? '') || byTitle(a, b))
      default:
        return list.sort(byTitle)
    }
  }, [songs, query, key, artist, onlyFavorites, sort, usage, isFavorite])

  const hasFilters = Boolean(query || key || artist || onlyFavorites)
  const usageMeta = (id: string) => {
    const u = usage[id]
    if (!u) return 'Ainda não utilizada'
    return `${u.count}x${u.lastUsed ? ` · última ${formatDateShort(u.lastUsed)}` : ''}`
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Músicas"
        description="Biblioteca da equipe com tons, cifras, letras e vídeos."
        actions={
          can('songs:write') && (
            <ButtonLink to="/musicas/nova" leftIcon={<Plus />}>
              Nova música
            </ButtonLink>
          )
        }
      />

      <div className="mb-5 space-y-3">
        <SearchBar value={query} onChange={(v) => setParam('q', v)} placeholder="Buscar por nome, artista, álbum ou tema…" size="lg" />
        <div className="scrollbar-none relative -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <button
            type="button"
            onClick={() => setParam('favoritas', onlyFavorites ? '' : '1')}
            aria-pressed={onlyFavorites}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold ring-1 transition-colors ring-inset',
              onlyFavorites
                ? 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
                : 'bg-surface text-ink-2 ring-line hover:bg-surface-2',
            )}
          >
            <Heart className={cn('size-4', onlyFavorites && 'fill-current')} /> Favoritas
          </button>
          <div className="w-40 shrink-0">
            <Select value={key} onChange={(e) => setParam('tom', e.target.value)} placeholder="Todos os tons" aria-label="Filtrar por tom" options={keys.map((k) => ({ value: k, label: `Tom ${k}` }))} />
          </div>
          <div className="w-48 shrink-0">
            <Select value={artist} onChange={(e) => setParam('artista', e.target.value)} placeholder="Todos os artistas" aria-label="Filtrar por artista" options={artists.map((a) => ({ value: a, label: a }))} />
          </div>
          <div className="w-44 shrink-0">
            <Select
              value={sort}
              onChange={(e) => setParam('ordem', e.target.value)}
              aria-label="Ordenar"
              options={[
                { value: 'title', label: 'Ordem: A–Z' },
                { value: 'recent', label: 'Adicionadas recentemente' },
                { value: 'most_used', label: 'Mais utilizadas' },
                { value: 'last_used', label: 'Usadas recentemente' },
              ]}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" leftIcon={<FilterX />} onClick={clearFilters} className="shrink-0">
              Limpar
            </Button>
          )}
          <SegmentedControl
            label="Visualização"
            value={view}
            onChange={setView}
            className="ml-auto shrink-0"
            options={[
              { value: 'grid', label: <span className="sr-only">Grade</span>, icon: <LayoutGrid /> },
              { value: 'list', label: <span className="sr-only">Lista</span>, icon: <List /> },
            ]}
          />
        </div>
        {!isLoading && <p className="text-xs font-medium text-ink-3">{pluralize(filtered.length, 'música')}</p>}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonGrid count={9} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Music2 />}
          title={songs.length === 0 ? 'Biblioteca vazia' : 'Nenhuma música encontrada'}
          description={songs.length === 0 ? 'Cadastre a primeira música da equipe.' : onlyFavorites ? 'Você ainda não favoritou músicas com esses filtros.' : 'Tente outro termo ou limpe os filtros.'}
          action={
            <>
              {hasFilters && (
                <Button variant="secondary" leftIcon={<FilterX />} onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
              {can('songs:write') && (
                <ButtonLink to="/musicas/nova" leftIcon={<Plus />}>
                  Nova música
                </ButtonLink>
              )}
            </>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((song) => (
            <article key={song.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg">
              <div className="flex items-center gap-4 p-4">
                <SongCover title={song.title} src={song.coverUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-ink">
                    <Link to={`/musicas/${song.id}`} className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-brand-500">
                      {song.title}
                    </Link>
                  </h3>
                  <p className="truncate text-[13px] text-ink-3">{song.artist}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggle(song.id, song.title)}
                  aria-pressed={isFavorite(song.id)}
                  aria-label={isFavorite(song.id) ? `Remover ${song.title} dos favoritos` : `Favoritar ${song.title}`}
                  className={cn(
                    'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                    isFavorite(song.id) ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <Heart className={cn('size-[18px]', isFavorite(song.id) && 'fill-current')} />
                </button>
              </div>
              <div className="mt-auto flex items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-2.5 text-xs text-ink-3">
                <KeyBadge value={song.teamKey} size="sm" />
                {song.bpm && <span className="tabular font-semibold">{song.bpm} BPM</span>}
                <span className="ml-auto inline-flex items-center gap-1 truncate">
                  <Music className="size-3.5" aria-hidden /> {usageMeta(song.id)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              videoCount={song.videoCount}
              meta={usageMeta(song.id)}
              favorite={isFavorite(song.id)}
              onToggleFavorite={() => void toggle(song.id, song.title)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
