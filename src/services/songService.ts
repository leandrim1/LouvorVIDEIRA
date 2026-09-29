import { isUpcoming } from '@/lib/dates'
import { generateId } from '@/lib/utils'
import type {
  Song,
  SongInput,
  SongLink,
  SongUsage,
  SongVideo,
  SongVideoInput,
  SongWithRelations,
} from '@/types'
import { NotFoundError, db } from './db'
import { notificationService } from './notificationService'

const VIDEO_ORDER: Record<SongVideo['type'], number> = { official: 0, study: 1, rehearsal: 2, live: 3, other: 4 }

const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title, 'pt-BR')

function toSongRow(input: SongInput): Omit<Song, 'id' | 'createdAt' | 'updatedAt'> {
  const { videos: _videos, links: _links, ...song } = input
  return {
    ...song,
    title: song.title.trim(),
    artist: song.artist.trim(),
    album: song.album.trim(),
    composer: song.composer.trim(),
    originalKey: song.originalKey.trim(),
    teamKey: song.teamKey.trim(),
  }
}

async function replaceMedia(songId: string, input: SongInput) {
  const now = new Date().toISOString()
  await Promise.all([db.removeWhere('song_videos', { songId }), db.removeWhere('song_links', { songId })])
  const videos: SongVideo[] = input.videos
    .filter((v) => v.url.trim())
    .map((v) => ({ id: v.id ?? generateId(), songId, type: v.type, title: v.title.trim(), url: v.url.trim(), createdAt: now }))
  const links: SongLink[] = input.links
    .filter((l) => l.url.trim())
    .map((l) => ({ id: l.id ?? generateId(), songId, type: l.type, label: l.label.trim(), url: l.url.trim(), createdAt: now }))
  await Promise.all([db.insertMany('song_videos', videos), db.insertMany('song_links', links)])
}

/** Ao mudar o tom da equipe, atualiza os próximos repertórios que usavam o tom anterior */
async function propagateKeyChange(songId: string, oldKey: string, newKey: string) {
  const [items, repertoires, events] = await Promise.all([
    db.list('repertoire_songs', { songId }),
    db.list('repertoires'),
    db.list('events'),
  ])
  const upcomingRepertoires = new Set(
    repertoires
      .filter((r) => {
        const event = events.find((e) => e.id === r.eventId)
        return event ? isUpcoming(event.date, event.startTime) : false
      })
      .map((r) => r.id),
  )
  await Promise.all(
    items
      .filter((item) => item.key === oldKey && upcomingRepertoires.has(item.repertoireId))
      .map((item) => db.update('repertoire_songs', item.id, { key: newKey })),
  )
}

export const songService = {
  async list(): Promise<Song[]> {
    const songs = await db.list('songs')
    return songs.sort(byTitle)
  },

  async listWithVideos(): Promise<Array<Song & { videoCount: number }>> {
    const [songs, videos] = await Promise.all([db.list('songs'), db.list('song_videos')])
    return songs.sort(byTitle).map((s) => ({ ...s, videoCount: videos.filter((v) => v.songId === s.id).length }))
  },

  async getById(id: string): Promise<SongWithRelations> {
    const [song, videos, links] = await Promise.all([
      db.get('songs', id),
      db.list('song_videos', { songId: id }),
      db.list('song_links', { songId: id }),
    ])
    if (!song) throw new NotFoundError('Música')
    return {
      ...song,
      videos: videos.sort((a, b) => VIDEO_ORDER[a.type] - VIDEO_ORDER[b.type]),
      links,
    }
  },

  async create(input: SongInput): Promise<Song> {
    const now = new Date().toISOString()
    const song: Song = { ...toSongRow(input), id: generateId(), createdAt: now, updatedAt: now }
    await db.insert('songs', song)
    await replaceMedia(song.id, input)
    await notificationService.create({
      type: 'song',
      title: 'Nova música na biblioteca',
      message: `A música "${song.title}" foi adicionada à biblioteca.`,
      link: `/musicas/${song.id}`,
    })
    return song
  },

  async update(id: string, input: SongInput): Promise<Song> {
    const existing = await db.get('songs', id)
    if (!existing) throw new NotFoundError('Música')
    const updated = await db.update('songs', id, { ...toSongRow(input), updatedAt: new Date().toISOString() })
    await replaceMedia(id, input)
    if (existing.teamKey !== updated.teamKey) {
      await propagateKeyChange(id, existing.teamKey, updated.teamKey)
      await notificationService.create({
        type: 'key_change',
        title: 'Tom alterado',
        message: `O tom de "${updated.title}" foi alterado para ${updated.teamKey}.`,
        link: `/musicas/${id}`,
      })
    }
    return updated
  },

  async setTeamKey(id: string, key: string): Promise<Song> {
    const existing = await db.get('songs', id)
    if (!existing) throw new NotFoundError('Música')
    if (existing.teamKey === key) return existing
    const updated = await db.update('songs', id, { teamKey: key, updatedAt: new Date().toISOString() })
    await propagateKeyChange(id, existing.teamKey, key)
    await notificationService.create({
      type: 'key_change',
      title: 'Tom alterado',
      message: `O tom de "${updated.title}" foi alterado para ${key}.`,
      link: `/musicas/${id}`,
    })
    return updated
  },

  async addVideo(songId: string, input: SongVideoInput): Promise<SongVideo> {
    return db.insert('song_videos', {
      id: generateId(),
      songId,
      type: input.type,
      title: input.title.trim(),
      url: input.url.trim(),
      createdAt: new Date().toISOString(),
    })
  },

  async removeVideo(videoId: string): Promise<void> {
    await db.remove('song_videos', videoId)
  },

  async remove(id: string): Promise<void> {
    const items = await db.list('repertoire_songs', { songId: id })
    await Promise.all(items.map((item) => db.removeWhere('song_preparations', { repertoireSongId: item.id })))
    await Promise.all([
      db.removeWhere('repertoire_songs', { songId: id }),
      db.removeWhere('song_videos', { songId: id }),
      db.removeWhere('song_links', { songId: id }),
      db.removeWhere('song_notes', { songId: id }),
      db.removeWhere('favorites', { songId: id }),
      db.removeWhere('song_views', { songId: id }),
    ])
    await db.remove('songs', id)
  },

  /** Estatísticas de uso das músicas nos repertórios */
  async getUsage(): Promise<Record<string, SongUsage>> {
    const [items, repertoires, events] = await Promise.all([
      db.list('repertoire_songs'),
      db.list('repertoires'),
      db.list('events'),
    ])
    const usage: Record<string, SongUsage> = {}
    for (const item of items) {
      const repertoire = repertoires.find((r) => r.id === item.repertoireId)
      const event = repertoire ? events.find((e) => e.id === repertoire.eventId) : undefined
      if (!repertoire || !event) continue
      const entry = (usage[item.songId] ||= { songId: item.songId, count: 0, lastUsed: null, nextUse: null, repertoires: [] })
      entry.count++
      entry.repertoires.push({ id: repertoire.id, name: repertoire.name, date: event.date })
      if (isUpcoming(event.date, event.startTime)) {
        if (!entry.nextUse || event.date < entry.nextUse) entry.nextUse = event.date
      } else if (!entry.lastUsed || event.date > entry.lastUsed) {
        entry.lastUsed = event.date
      }
    }
    for (const entry of Object.values(usage)) entry.repertoires.sort((a, b) => b.date.localeCompare(a.date))
    return usage
  },
}
