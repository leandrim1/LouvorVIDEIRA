import { useMemo, useState } from 'react'
import { Heart, History, Music2, TrendingUp } from 'lucide-react'
import { useRecentViews, useSongUsage, useSongs } from '@/hooks/useData'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle'
import { formatDateShort, timeAgo } from '@/lib/dates'
import { ButtonLink, EmptyState, ErrorState, PageHeader, SkeletonList, Tabs } from '@/components/ui'
import { SongCard } from '@/components/songs/SongCard'

type Tab = 'favorites' | 'recent' | 'most_used'

export default function FavoritesPage() {
  useDocumentTitle('Minhas músicas')
  const [tab, setTab] = useState<Tab>('favorites')
  const { data: songs = [], isLoading, error, refetch } = useSongs()
  const { data: views = [] } = useRecentViews()
  const { data: usage = {} } = useSongUsage()
  const { toggle, isFavorite, favoriteIds } = useFavoriteToggle()

  const lists = useMemo(() => {
    const byId = new Map(songs.map((s) => [s.id, s]))
    return {
      favorites: favoriteIds.flatMap((id) => (byId.get(id) ? [{ song: byId.get(id)!, meta: undefined as string | undefined }] : [])),
      recent: views.flatMap((v) => (byId.get(v.songId) ? [{ song: byId.get(v.songId)!, meta: `Acessada ${timeAgo(v.viewedAt)}` }] : [])),
      most_used: songs
        .filter((s) => usage[s.id])
        .sort((a, b) => usage[b.id].count - usage[a.id].count)
        .slice(0, 12)
        .map((song) => ({
          song,
          meta: `${usage[song.id].count}x em repertórios${usage[song.id].lastUsed ? ` · última ${formatDateShort(usage[song.id].lastUsed!)}` : ''}`,
        })),
    }
  }, [songs, views, usage, favoriteIds])

  const list = lists[tab]
  const empty = {
    favorites: { icon: <Heart />, title: 'Nenhuma música favorita', description: 'Toque no coração de uma música para acessá-la rapidamente aqui.' },
    recent: { icon: <History />, title: 'Nenhum acesso recente', description: 'As músicas que você abrir aparecerão aqui.' },
    most_used: { icon: <TrendingUp />, title: 'Sem histórico de uso', description: 'As músicas mais tocadas nos repertórios aparecerão aqui.' },
  }[tab]

  return (
    <div className="animate-fade-up">
      <PageHeader title="Minhas músicas" description="Favoritas, acessadas recentemente e as mais utilizadas pela equipe." />
      <Tabs<Tab>
        label="Listas"
        value={tab}
        onChange={setTab}
        variant="pills"
        className="mb-5"
        items={[
          { value: 'favorites', label: 'Favoritas', icon: <Heart />, count: lists.favorites.length },
          { value: 'recent', label: 'Recentes', icon: <History />, count: lists.recent.length },
          { value: 'most_used', label: 'Mais utilizadas', icon: <TrendingUp /> },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList count={5} />
      ) : list.length === 0 ? (
        <EmptyState
          {...empty}
          action={
            <ButtonLink to="/musicas" variant="secondary" leftIcon={<Music2 />}>
              Explorar músicas
            </ButtonLink>
          }
        />
      ) : (
        <ol className="grid gap-2.5 lg:grid-cols-2">
          {list.map(({ song, meta }, i) => (
            <li key={song.id} className="flex items-center gap-2">
              {tab === 'most_used' && <span className="tabular w-6 shrink-0 text-center font-mono text-sm font-bold text-ink-3">{i + 1}</span>}
              <SongCard
                className="flex-1"
                song={song}
                meta={meta}
                videoCount={song.videoCount}
                favorite={isFavorite(song.id)}
                onToggleFavorite={() => void toggle(song.id, song.title)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
