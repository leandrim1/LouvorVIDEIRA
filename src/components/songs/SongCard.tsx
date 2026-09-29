import { Link } from 'react-router-dom'
import { Gauge, Heart, Mic2, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member, Song, SongPreparation } from '@/types'
import { KeyBadge } from '@/components/ui'
import { MusicStatusBadge } from './MusicStatus'
import { SongCover } from './SongCover'

interface SongCardProps {
  song: Song
  href?: string
  /** Número na ordem do repertório */
  position?: number
  keyOverride?: string
  leadVocal?: Member | null
  instrumentation?: string
  preparation?: SongPreparation | null
  showStatus?: boolean
  videoCount?: number
  favorite?: boolean
  onToggleFavorite?: () => void
  meta?: string
  className?: string
}

/**
 * Card de música. Com `position` vira item de setlist (número, tom, vocal,
 * instrumentação e status); sem `position` é o card da biblioteca.
 */
export function SongCard({
  song,
  href = `/musicas/${song.id}`,
  position,
  keyOverride,
  leadVocal,
  instrumentation,
  preparation,
  showStatus,
  videoCount,
  favorite,
  onToggleFavorite,
  meta,
  className,
}: SongCardProps) {
  const keyValue = keyOverride ?? song.teamKey
  const setlist = position !== undefined

  return (
    <article
      className={cn(
        'group relative flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-3 shadow-xs transition-all hover:border-line-strong hover:shadow-md sm:p-3.5',
        className,
      )}
    >
      {setlist ? (
        <span className="tabular flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-mono text-lg font-bold text-ink-2 ring-1 ring-line">
          {String(position).padStart(2, '0')}
        </span>
      ) : (
        <SongCover title={song.title} src={song.coverUrl} size="sm" />
      )}

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-ink">
          <Link to={href} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-brand-500">
            {song.title}
          </Link>
        </h3>
        <p className="truncate text-[13px] text-ink-3">{song.artist}</p>
        {(setlist || meta) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {leadVocal && (
              <span className="inline-flex items-center gap-1">
                <Mic2 className="size-3.5" aria-hidden /> {leadVocal.name.split(' ')[0]}
              </span>
            )}
            {instrumentation && <span className="truncate">{instrumentation}</span>}
            {setlist && song.bpm && (
              <span className="tabular inline-flex items-center gap-1">
                <Gauge className="size-3.5" aria-hidden /> {song.bpm} BPM
              </span>
            )}
            {meta && <span className="truncate">{meta}</span>}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <KeyBadge value={keyValue} size="sm" />
        {showStatus && <MusicStatusBadge preparation={preparation ?? null} />}
        {!setlist && !showStatus && videoCount !== undefined && videoCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-3" title={`${videoCount} vídeo(s)`}>
            <Video className="size-3.5" aria-hidden /> {videoCount}
          </span>
        )}
      </div>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            'relative z-10 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
            favorite ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
          )}
          aria-label={favorite ? `Remover ${song.title} dos favoritos` : `Favoritar ${song.title}`}
          aria-pressed={favorite}
        >
          <Heart className={cn('size-[18px]', favorite && 'fill-current')} />
        </button>
      )}
    </article>
  )
}
