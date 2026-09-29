import type { SongLinkType } from '@/types'

export type VideoProvider = 'youtube' | 'vimeo' | 'other'

export interface ParsedVideo {
  provider: VideoProvider
  id: string | null
  embedUrl: string | null
  thumbnailUrl: string | null
  watchUrl: string
  start: number | null
}

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

function parseStart(value: string | null): number | null {
  if (!value) return null
  if (/^\d+$/.test(value)) return Number(value)
  const match = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  if (!match) return null
  const [, h = '0', m = '0', s = '0'] = match
  const total = Number(h) * 3600 + Number(m) * 60 + Number(s)
  return total > 0 ? total : null
}

export function getYouTubeId(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (YOUTUBE_HOSTS.includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
      id = match?.[1] ?? null
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

export function getVimeoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim())
    if (!url.hostname.endsWith('vimeo.com')) return null
    const match = url.pathname.match(/\/(?:video\/)?(\d{6,})/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function parseVideoUrl(rawUrl: string): ParsedVideo {
  const watchUrl = rawUrl.trim()
  const youtubeId = getYouTubeId(watchUrl)
  if (youtubeId) {
    let start: number | null = null
    try {
      const url = new URL(watchUrl)
      start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'))
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
    if (start) params.set('start', String(start))
    return {
      provider: 'youtube',
      id: youtubeId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      watchUrl,
      start,
    }
  }
  const vimeoId = getVimeoId(watchUrl)
  if (vimeoId) {
    return {
      provider: 'vimeo',
      id: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?dnt=1`,
      thumbnailUrl: null,
      watchUrl,
      start: null,
    }
  }
  return { provider: 'other', id: null, embedUrl: null, thumbnailUrl: null, watchUrl, start: null }
}

/** Detecta automaticamente o tipo de link externo */
export function detectLinkType(rawUrl: string): SongLinkType {
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase()
    if (host.includes('youtube') || host === 'youtu.be') return 'youtube'
    if (host.includes('spotify')) return 'spotify'
    if (host.includes('music.apple') || host.includes('itunes.apple')) return 'apple_music'
    if (host.includes('cifraclub')) return 'cifraclub'
    if (host.includes('deezer')) return 'deezer'
  } catch {
    /* ignore */
  }
  return 'other'
}

export function hostnameOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '')
  } catch {
    return rawUrl
  }
}
