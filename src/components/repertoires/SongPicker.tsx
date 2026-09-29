import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { matchesQuery } from '@/lib/utils'
import type { Song, SongUsage } from '@/types'
import { formatDateShort } from '@/lib/dates'
import { KeyBadge, SearchBar } from '@/components/ui'
import { SongCover } from '@/components/songs/SongCover'

interface SongPickerProps {
  songs: Song[]
  selectedIds: string[]
  onAdd: (song: Song) => void
  usage?: Record<string, SongUsage>
}

/** Pesquisar e adicionar músicas ao repertório */
export function SongPicker({ songs, selectedIds, onAdd, usage }: SongPickerProps) {
  const [query, setQuery] = useState('')
  const results = useMemo(
    () => songs.filter((s) => matchesQuery(query, s.title, s.artist, s.teamKey, s.tags.join(' '))).slice(0, 60),
    [songs, query],
  )

  return (
    <div className="space-y-3">
      <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar música, artista ou tom…" label="Pesquisar música para adicionar" />
      {results.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3">
          <Search className="size-4" aria-hidden /> Nenhuma música encontrada.
        </p>
      ) : (
        <ul className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto pr-1">
          {results.map((song) => {
            const added = selectedIds.includes(song.id)
            const last = usage?.[song.id]?.lastUsed
            return (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => !added && onAdd(song)}
                  disabled={added}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  aria-label={added ? `${song.title} já adicionada` : `Adicionar ${song.title}`}
                >
                  <SongCover title={song.title} src={song.coverUrl} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{song.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {song.artist}
                      {last && ` · última vez ${formatDateShort(last)}`}
                    </span>
                  </span>
                  <KeyBadge value={song.teamKey} size="sm" label={false} />
                  <span
                    className={
                      added
                        ? 'flex size-8 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400'
                        : 'flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white dark:bg-brand-600'
                    }
                    aria-hidden
                  >
                    {added ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
