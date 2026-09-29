import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Eye, FileText, Gauge, Mic2, Play, ScrollText, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RepertoireSongDetail } from '@/types'
import type { PreparationPatch } from '@/services/preparationService'
import { Button, KeyBadge } from '@/components/ui'
import { MusicStatus, MusicStatusBadge } from '@/components/songs/MusicStatus'

interface SetlistItemProps {
  item: RepertoireSongDetail
  position: number
  repertoireId: string
  onPlayVideo: (item: RepertoireSongDetail) => void
  onPreparationChange?: (patch: PreparationPatch) => void
}

/** Item da ordem do repertório com ações rápidas (música, vídeo, cifra, letra) */
export function SetlistItem({ item, position, repertoireId, onPlayVideo, onPreparationChange }: SetlistItemProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { song } = item
  const base = `/musicas/${song.id}?repertorio=${repertoireId}`
  const hasVideo = item.videos.length > 0

  return (
    <li className="rounded-2xl border border-line bg-surface shadow-xs transition-shadow hover:shadow-md">
      <div className="flex gap-3.5 p-3.5 sm:gap-4 sm:p-4">
        <span className="tabular flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-mono text-xl font-extrabold text-ink ring-1 ring-line sm:size-14 sm:text-2xl">
          {String(position).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base leading-tight font-bold text-ink sm:text-lg">
                <button type="button" onClick={() => navigate(base)} className="text-left hover:text-brand-700 dark:hover:text-brand-300">
                  {song.title}
                </button>
              </h3>
              <p className="truncate text-[13px] text-ink-3">{song.artist}</p>
            </div>
            <KeyBadge value={item.key} size="lg" className="h-9 px-3 text-sm" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-ink-2">
            {song.bpm && (
              <span className="tabular inline-flex items-center gap-1">
                <Gauge className="size-3.5 text-ink-3" aria-hidden /> BPM {song.bpm}
              </span>
            )}
            {item.leadVocal && (
              <span className="inline-flex items-center gap-1">
                <Mic2 className="size-3.5 text-ink-3" aria-hidden /> {item.leadVocal.name}
              </span>
            )}
            {item.instrumentation && <span className="text-ink-3">{item.instrumentation}</span>}
            {song.capo ? <span className="text-ink-3">Capo {song.capo}ª casa</span> : null}
          </div>

          {item.notes && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {item.notes}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2.5 sm:px-4">
        <div className="grid flex-1 grid-cols-4 gap-1.5 sm:flex sm:flex-none">
          <Button variant="subtle" size="sm" leftIcon={<Eye />} onClick={() => navigate(base)} className="px-2 sm:px-3">
            <span className="sm:hidden">Música</span>
            <span className="hidden sm:inline">Ver música</span>
          </Button>
          <Button
            variant="subtle"
            size="sm"
            leftIcon={<Play />}
            onClick={() => onPlayVideo(item)}
            disabled={!hasVideo}
            title={hasVideo ? undefined : 'Sem vídeo cadastrado'}
            className="px-2 sm:px-3"
          >
            Vídeo
          </Button>
          <Button variant="subtle" size="sm" leftIcon={<FileText />} onClick={() => navigate(`${base}&aba=cifra`)} className="px-2 sm:px-3">
            Cifra
          </Button>
          <Button variant="subtle" size="sm" leftIcon={<ScrollText />} onClick={() => navigate(`${base}&aba=letra`)} className="px-2 sm:px-3">
            Letra
          </Button>
        </div>
        {onPreparationChange && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg py-1 pl-1 text-xs font-semibold text-ink-2 hover:text-ink"
          >
            <MusicStatusBadge preparation={item.preparation} showProgress />
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
            <span className="sr-only">Minha preparação</span>
          </button>
        )}
      </div>

      {open && onPreparationChange && (
        <div className="animate-fade-in border-t border-line bg-surface-2/40 p-4">
          <p className="mb-3 text-xs font-bold tracking-wide text-ink-3 uppercase">Minha preparação</p>
          <MusicStatus preparation={item.preparation} onChange={onPreparationChange} />
        </div>
      )}
    </li>
  )
}
