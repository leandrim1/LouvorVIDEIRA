import { isPast } from './dates'
import type { ChurchEvent, RepertoireStatus } from '@/types'

export type RepertoireDisplayStatus = 'draft' | 'published' | 'done'

export const DISPLAY_STATUS_LABELS: Record<RepertoireDisplayStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  done: 'Realizado',
}

/** Status exibido: rascunho, publicado (futuro) ou realizado (passado) */
export function repertoireDisplayStatus(status: RepertoireStatus, event: ChurchEvent): RepertoireDisplayStatus {
  if (status === 'draft') return 'draft'
  return isPast(event.date, event.startTime) ? 'done' : 'published'
}
