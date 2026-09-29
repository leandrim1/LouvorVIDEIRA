import { EMPTY_CHECKLIST, checklistForStatus, statusFromChecklist } from '@/lib/preparation'
import { generateId } from '@/lib/utils'
import type { PreparationChecklist, PreparationStatus, SongPreparation } from '@/types'
import { db } from './db'

export type PreparationPatch = Partial<PreparationChecklist> | { status: PreparationStatus }

export const preparationService = {
  async listForMember(memberId: string): Promise<SongPreparation[]> {
    return db.list('song_preparations', { memberId })
  },

  /** Atualiza (ou cria) a preparação do integrante para uma música do repertório */
  async update(repertoireSongId: string, memberId: string, patch: PreparationPatch): Promise<SongPreparation> {
    const [existing] = await db.list('song_preparations', { repertoireSongId, memberId })
    const current: PreparationChecklist = existing
      ? {
          videoWatched: existing.videoWatched,
          chordsStudied: existing.chordsStudied,
          keyConfirmed: existing.keyConfirmed,
          rehearsed: existing.rehearsed,
        }
      : { ...EMPTY_CHECKLIST }

    const checklist = 'status' in patch ? checklistForStatus(patch.status, current) : { ...current, ...patch }
    const status = 'status' in patch ? patch.status : statusFromChecklist(checklist)
    const updatedAt = new Date().toISOString()

    if (existing) return db.update('song_preparations', existing.id, { ...checklist, status, updatedAt })
    return db.insert('song_preparations', { id: generateId(), repertoireSongId, memberId, ...checklist, status, updatedAt })
  },
}
