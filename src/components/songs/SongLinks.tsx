import { ExternalLink, Link2, Music, PlayCircle, FileText, Disc3, Apple } from 'lucide-react'
import type { ReactNode } from 'react'
import { LINK_TYPE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { hostnameOf } from '@/lib/video'
import type { SongLink, SongLinkType } from '@/types'
import { EmptyState } from '@/components/ui'

const LINK_STYLES: Record<SongLinkType, { icon: ReactNode; className: string }> = {
  spotify: { icon: <Music />, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  youtube: { icon: <PlayCircle />, className: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  apple_music: { icon: <Apple />, className: 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400' },
  cifraclub: { icon: <FileText />, className: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' },
  deezer: { icon: <Disc3 />, className: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' },
  other: { icon: <Link2 />, className: 'bg-surface-2 text-ink-2' },
}

export function SongLinks({ links }: { links: SongLink[] }) {
  if (links.length === 0) {
    return <EmptyState compact icon={<Link2 />} title="Nenhum link cadastrado" description="Spotify, Apple Music, Cifra Club e outros." />
  }
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {links.map((link) => {
        const style = LINK_STYLES[link.type]
        return (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-all hover:border-line-strong hover:shadow-md"
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5', style.className)}>{style.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{link.label || LINK_TYPE_LABELS[link.type]}</span>
                <span className="block truncate text-xs text-ink-3">{hostnameOf(link.url)}</span>
              </span>
              <ExternalLink className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
