import type { ReactNode } from 'react'
import { CalendarDays, ListMusic, Music2, User } from 'lucide-react'
import type { SearchResult, SearchResultKind } from '@/types'

export const KIND_META: Record<SearchResultKind, { label: string; icon: ReactNode }> = {
  song: { label: 'Músicas', icon: <Music2 /> },
  repertoire: { label: 'Repertórios', icon: <ListMusic /> },
  event: { label: 'Eventos', icon: <CalendarDays /> },
  member: { label: 'Integrantes', icon: <User /> },
}

export const KIND_ORDER: SearchResultKind[] = ['song', 'repertoire', 'event', 'member']

export function groupResults(results: SearchResult[]) {
  return KIND_ORDER.map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) })).filter((g) => g.items.length > 0)
}
