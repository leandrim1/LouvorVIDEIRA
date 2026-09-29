import { useState } from 'react'
import { ExternalLink, Link2, Play } from 'lucide-react'
import { VIDEO_TYPE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { hostnameOf, parseVideoUrl } from '@/lib/video'
import type { SongVideoType } from '@/types'

interface SongPlayerProps {
  url: string
  title?: string
  type?: SongVideoType
  className?: string
  /** Carrega o player imediatamente (sem capa) */
  autoLoad?: boolean
}

/**
 * Player de vídeo. Detecta YouTube/Vimeo e gera o player incorporado.
 * No YouTube usa uma "capa leve" e só carrega o iframe ao tocar (economiza dados no celular).
 */
export function SongPlayer({ url, title, type, className, autoLoad }: SongPlayerProps) {
  const video = parseVideoUrl(url)
  const [loaded, setLoaded] = useState(Boolean(autoLoad))
  const label = title || (type ? VIDEO_TYPE_LABELS[type] : 'Vídeo')

  // Onde players externos não podem ser incorporados (ex.: Artifact), mostra o link
  if (video.provider === 'other' || import.meta.env.VITE_EMBED_VIDEOS === 'false') {
    return (
      <a
        href={video.watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4 transition-colors hover:bg-surface-3',
          className,
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-2 ring-1 ring-line">
          <Link2 className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{label}</span>
          <span className="block truncate text-xs text-ink-3">{hostnameOf(video.watchUrl)}</span>
        </span>
        <ExternalLink className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        <span className="sr-only">(abre em nova aba)</span>
      </a>
    )
  }

  const iframeSrc = video.provider === 'vimeo' ? video.embedUrl! : `${video.embedUrl}&autoplay=${autoLoad ? 0 : 1}`
  const showIframe = video.provider === 'vimeo' || loaded

  return (
    <figure className={cn('overflow-hidden rounded-2xl border border-line bg-black', className)}>
      <div className="relative aspect-video w-full">
        {showIframe ? (
          <iframe
            src={iframeSrc}
            title={label}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="group absolute inset-0 flex size-full items-center justify-center"
            aria-label={`Reproduzir: ${label}`}
          >
            {video.thumbnailUrl && (
              <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" aria-hidden />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-xl transition-transform group-hover:scale-105 group-active:scale-95">
              <Play className="ml-1 size-7 fill-current" aria-hidden />
            </span>
            <span className="absolute right-4 bottom-3 left-4 truncate text-left text-sm font-semibold text-white">{label}</span>
          </button>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{label}</span>
          {type && title && <span className="block text-xs text-ink-3">{VIDEO_TYPE_LABELS[type]}</span>}
        </span>
        <a
          href={video.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {video.provider === 'youtube' ? 'YouTube' : 'Vimeo'} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </figcaption>
    </figure>
  )
}
