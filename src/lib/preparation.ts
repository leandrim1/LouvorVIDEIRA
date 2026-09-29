import type { PreparationChecklist, PreparationStatus, SongPreparation } from '@/types'

export const CHECKLIST_KEYS: Array<keyof PreparationChecklist> = ['videoWatched', 'chordsStudied', 'keyConfirmed', 'rehearsed']

export const EMPTY_CHECKLIST: PreparationChecklist = {
  videoWatched: false,
  chordsStudied: false,
  keyConfirmed: false,
  rehearsed: false,
}

export function checklistCount(checklist: PreparationChecklist | null | undefined): number {
  if (!checklist) return 0
  return CHECKLIST_KEYS.filter((key) => checklist[key]).length
}

export function checklistProgress(checklist: PreparationChecklist | null | undefined): number {
  return Math.round((checklistCount(checklist) / CHECKLIST_KEYS.length) * 100)
}

export function statusFromChecklist(checklist: PreparationChecklist): PreparationStatus {
  const done = checklistCount(checklist)
  if (done === 0) return 'not_studied'
  if (done === CHECKLIST_KEYS.length) return 'ready'
  return 'studying'
}

/** Ajusta o checklist para ficar coerente com um status escolhido manualmente */
export function checklistForStatus(status: PreparationStatus, current: PreparationChecklist): PreparationChecklist {
  if (status === 'ready') return { videoWatched: true, chordsStudied: true, keyConfirmed: true, rehearsed: true }
  if (status === 'not_studied') return { ...EMPTY_CHECKLIST }
  const done = checklistCount(current)
  if (done === 0) return { ...current, videoWatched: true }
  if (done === CHECKLIST_KEYS.length) return { ...current, rehearsed: false }
  return current
}

/** Percentual médio de preparação de um conjunto de músicas */
export function overallProgress(preparations: Array<SongPreparation | null>, totalSongs: number): number {
  if (totalSongs === 0) return 0
  const done = preparations.reduce((sum, p) => sum + checklistCount(p), 0)
  return Math.round((done / (totalSongs * CHECKLIST_KEYS.length)) * 100)
}
