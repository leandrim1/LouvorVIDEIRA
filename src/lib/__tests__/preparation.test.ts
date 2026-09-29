import { describe, expect, it } from 'vitest'
import { checklistForStatus, checklistProgress, overallProgress, statusFromChecklist, EMPTY_CHECKLIST } from '../preparation'
import type { SongPreparation } from '@/types'

const prep = (done: number): SongPreparation => ({
  id: 'x',
  repertoireSongId: 'rs',
  memberId: 'm',
  videoWatched: done > 0,
  chordsStudied: done > 1,
  keyConfirmed: done > 2,
  rehearsed: done > 3,
  status: 'studying',
  updatedAt: '',
})

describe('preparação', () => {
  it('calcula status a partir do checklist', () => {
    expect(statusFromChecklist(EMPTY_CHECKLIST)).toBe('not_studied')
    expect(statusFromChecklist({ ...EMPTY_CHECKLIST, videoWatched: true })).toBe('studying')
    expect(statusFromChecklist({ videoWatched: true, chordsStudied: true, keyConfirmed: true, rehearsed: true })).toBe('ready')
  })
  it('mantém checklist coerente ao escolher status', () => {
    expect(checklistProgress(checklistForStatus('ready', EMPTY_CHECKLIST))).toBe(100)
    expect(checklistProgress(checklistForStatus('not_studied', prep(3)))).toBe(0)
    expect(statusFromChecklist(checklistForStatus('studying', EMPTY_CHECKLIST))).toBe('studying')
  })
  it('calcula a porcentagem geral (ex.: 75%)', () => {
    expect(overallProgress([prep(4), prep(4), prep(3), prep(1)], 4)).toBe(75)
    expect(overallProgress([null, prep(4)], 2)).toBe(50)
  })
})
