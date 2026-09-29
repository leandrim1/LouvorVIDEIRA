import { EVENT_TYPE_LABELS, MEMBER_ROLE_LABELS } from '@/lib/constants'
import { formatDateShort, formatDayMonth, formatTime } from '@/lib/dates'
import { parseKey } from '@/lib/music'
import { matchesQuery, normalize } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { db } from './db'
import { eventService } from './eventService'
import { songService } from './songService'

const MAX_PER_GROUP = 6

/** Reconhece buscas por tonalidade: "C", "tom C", "F#m", "tom: bb" */
function detectKeyQuery(query: string): string | null {
  const cleaned = query.trim().replace(/^tom\s*:?\s*/i, '')
  const candidate = cleaned.length <= 3 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
  return parseKey(candidate) ? candidate : null
}

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim()
    if (q.length < 1) return []
    const [songs, usage, events, members] = await Promise.all([
      db.list('songs'),
      songService.getUsage(),
      eventService.listDetails(),
      db.list('members'),
    ])
    const keyQuery = detectKeyQuery(q)
    const results: SearchResult[] = []

    const songResults = songs
      .filter(
        (s) =>
          matchesQuery(q, s.title, s.artist, s.album, s.composer, s.tags.join(' ')) ||
          (keyQuery !== null && (s.teamKey === keyQuery || s.originalKey === keyQuery)),
      )
      .sort((a, b) => {
        // Prioriza títulos que começam com o termo buscado
        const nq = normalize(q)
        return Number(normalize(b.title).startsWith(nq)) - Number(normalize(a.title).startsWith(nq))
      })
      .slice(0, MAX_PER_GROUP)
      .map<SearchResult>((s) => {
        const last = usage[s.id]?.lastUsed
        return {
          kind: 'song',
          id: s.id,
          title: s.title,
          subtitle: s.artist,
          keyLabel: s.teamKey,
          meta: last ? `Última utilização: ${formatDateShort(last)}` : 'Ainda não utilizada',
          href: `/musicas/${s.id}`,
        }
      })
    results.push(...songResults)

    const repertoireResults = events
      .filter((e) => e.repertoire && e.type !== 'rehearsal')
      .filter((e) =>
        matchesQuery(q, e.repertoire!.name, e.title, formatDayMonth(e.date), formatDateShort(e.date), e.repertoire!.songTitles.join(' ')),
      )
      .slice(-MAX_PER_GROUP)
      .reverse()
      .map<SearchResult>((e) => ({
        kind: 'repertoire',
        id: e.repertoire!.id,
        title: e.repertoire!.name,
        subtitle: `${formatDateShort(e.date)} · ${formatTime(e.startTime)}`,
        meta: `${e.repertoire!.songCount} músicas`,
        href: `/repertorios/${e.repertoire!.id}`,
      }))
    results.push(...repertoireResults)

    const eventResults = events
      .filter((e) => matchesQuery(q, e.title, EVENT_TYPE_LABELS[e.type], e.location, formatDayMonth(e.date), formatDateShort(e.date)))
      .slice(0, MAX_PER_GROUP)
      .map<SearchResult>((e) => ({
        kind: 'event',
        id: e.id,
        title: e.title,
        subtitle: `${EVENT_TYPE_LABELS[e.type]} · ${formatDateShort(e.date)} · ${formatTime(e.startTime)}`,
        meta: e.location,
        href: `/calendario?evento=${e.id}`,
      }))
    results.push(...eventResults)

    const memberResults = members
      .filter((m) => matchesQuery(q, m.name, m.instrument, m.roles.map((r) => MEMBER_ROLE_LABELS[r]).join(' ')))
      .slice(0, MAX_PER_GROUP)
      .map<SearchResult>((m) => ({
        kind: 'member',
        id: m.id,
        title: m.name,
        subtitle: m.roles.map((r) => MEMBER_ROLE_LABELS[r]).join(', '),
        href: `/equipe?integrante=${m.id}`,
      }))
    results.push(...memberResults)

    return results
  },
}
