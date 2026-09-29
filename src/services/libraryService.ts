import { generateId } from '@/lib/utils'
import type { Member, SongNote, SongView } from '@/types'
import { db } from './db'

const MAX_HISTORY = 30

export interface SongNoteView extends SongNote {
  author: Member | null
}

/** Favoritos, histórico de acesso e observações da equipe */
export const favoriteService = {
  async listSongIds(userId: string): Promise<string[]> {
    const favorites = await db.list('favorites', { userId })
    return favorites.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((f) => f.songId)
  },

  /** Retorna `true` se a música passou a ser favorita */
  async toggle(userId: string, songId: string): Promise<boolean> {
    const existing = await db.list('favorites', { userId, songId })
    if (existing.length > 0) {
      await db.removeWhere('favorites', { userId, songId })
      return false
    }
    await db.insert('favorites', { id: generateId(), userId, songId, createdAt: new Date().toISOString() })
    return true
  },
}

export const historyService = {
  async record(userId: string, songId: string): Promise<void> {
    await db.removeWhere('song_views', { userId, songId })
    await db.insert('song_views', { id: generateId(), userId, songId, viewedAt: new Date().toISOString() })
    const views = await db.list('song_views', { userId })
    const excess = views.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt)).slice(MAX_HISTORY)
    await Promise.all(excess.map((v) => db.remove('song_views', v.id)))
  },

  async recent(userId: string): Promise<SongView[]> {
    const views = await db.list('song_views', { userId })
    return views.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
  },
}

export const noteService = {
  async listBySong(songId: string): Promise<SongNoteView[]> {
    const [notes, members] = await Promise.all([db.list('song_notes', { songId }), db.list('members')])
    return notes
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((n) => ({ ...n, author: members.find((m) => m.id === n.authorId) ?? null }))
  },

  async add(songId: string, authorId: string | null, content: string): Promise<SongNote> {
    return db.insert('song_notes', {
      id: generateId(),
      songId,
      authorId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    })
  },

  async remove(id: string): Promise<void> {
    await db.remove('song_notes', id)
  },
}
