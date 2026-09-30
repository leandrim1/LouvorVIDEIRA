import { formatWeekday, isUpcoming } from '@/lib/dates'
import { generateId } from '@/lib/utils'
import type {
  ChurchEvent,
  Repertoire,
  RepertoireDetail,
  RepertoireInput,
  RepertoireSong,
  RepertoireSongDetail,
  RepertoireSummary,
} from '@/types'
import { DataError, NotFoundError, db } from './db'
import { isServerMode } from './config'
import { dispatchNotification } from './pushService'
import { notificationService } from './notificationService'
import { buildRehearsalDetail, buildRepertoireSummary, buildScheduleDetail, byEventDate } from './relations'

function eventFields(input: RepertoireInput): Omit<ChurchEvent, 'id' | 'createdAt' | 'updatedAt' | 'endTime'> {
  return {
    title: input.name.trim(),
    type: input.eventType,
    date: input.date,
    startTime: input.startTime,
    location: input.location.trim(),
    description: input.description.trim(),
  }
}

async function syncSongs(repertoireId: string, input: RepertoireInput) {
  const existing = await db.list('repertoire_songs', { repertoireId })
  const keptIds = new Set<string>()
  const toInsert: RepertoireSong[] = []

  await Promise.all(
    input.songs.map((song, position) => {
      const match = existing.find((e) => e.songId === song.songId && !keptIds.has(e.id))
      const fields = {
        position,
        key: song.key,
        leadVocalId: song.leadVocalId,
        instrumentation: song.instrumentation,
        notes: song.notes.trim(),
      }
      if (match) {
        keptIds.add(match.id)
        return db.update('repertoire_songs', match.id, fields)
      }
      toInsert.push({ id: generateId(), repertoireId, songId: song.songId, ...fields })
      return Promise.resolve()
    }),
  )
  const removed = existing.filter((e) => !keptIds.has(e.id))
  await Promise.all(
    removed.map(async (item) => {
      await db.removeWhere('song_preparations', { repertoireSongId: item.id })
      await db.remove('repertoire_songs', item.id)
    }),
  )
  await db.insertMany('repertoire_songs', toInsert)
}

/** Repertório publicado: o servidor avisa (central + push) os integrantes relacionados */
async function notifyPublished(repertoire: Repertoire, event: ChurchEvent, kind: 'created' | 'updated' = 'created') {
  if (repertoire.status !== 'published' || !isUpcoming(event.date, event.startTime)) return
  if (isServerMode) return dispatchNotification(kind === 'created' ? 'REPERTOIRE_CREATED' : 'REPERTOIRE_UPDATED', repertoire.id)
  await notificationService.create({
    type: 'repertoire',
    title: 'Novo repertório',
    message: `Novo repertório adicionado para ${formatWeekday(event.date).toLowerCase()}.`,
    link: `/repertorios/${repertoire.id}`,
  })
}

export const repertoireService = {
  async listSummaries(): Promise<RepertoireSummary[]> {
    const [repertoires, events, items, songs] = await Promise.all([
      db.list('repertoires'),
      db.list('events'),
      db.list('repertoire_songs'),
      db.list('songs'),
    ])
    return repertoires
      .map((r) => buildRepertoireSummary(r, events, items, songs))
      .filter((r): r is RepertoireSummary => r !== null)
      .sort((a, b) => byEventDate(a.event, b.event))
  },

  async getDetail(id: string, memberId?: string | null): Promise<RepertoireDetail> {
    const repertoire = await db.get('repertoires', id)
    if (!repertoire) throw new NotFoundError('Repertório')
    const [events, items, songs, members, videos, preparations, schedules, scheduleMembers, rehearsals, repertoires] =
      await Promise.all([
        db.list('events'),
        db.list('repertoire_songs', { repertoireId: id }),
        db.list('songs'),
        db.list('members'),
        db.list('song_videos'),
        memberId ? db.list('song_preparations', { memberId }) : Promise.resolve([]),
        db.list('schedules'),
        db.list('schedule_members'),
        db.list('rehearsals'),
        db.list('repertoires'),
      ])
    const event = events.find((e) => e.id === repertoire.eventId)
    if (!event) throw new NotFoundError('Evento do repertório')

    const songsDetail: RepertoireSongDetail[] = items
      .sort((a, b) => a.position - b.position)
      .flatMap((item) => {
        const song = songs.find((s) => s.id === item.songId)
        if (!song) return []
        return [
          {
            ...item,
            song,
            leadVocal: members.find((m) => m.id === item.leadVocalId) ?? null,
            videos: videos.filter((v) => v.songId === song.id),
            preparation: preparations.find((p) => p.repertoireSongId === item.id) ?? null,
          },
        ]
      })

    const schedule = schedules.find((s) => s.eventId === event.id)
    const allItems = await db.list('repertoire_songs')
    return {
      ...repertoire,
      event,
      songs: songsDetail,
      schedule: schedule ? buildScheduleDetail(schedule, events, scheduleMembers, members) : null,
      rehearsals: rehearsals
        .filter((r) => r.repertoireId === id)
        .map((r) => buildRehearsalDetail(r, events, repertoires, allItems, songs))
        .filter((r) => r !== null)
        .sort((a, b) => byEventDate(a.event, b.event)),
    }
  },

  async create(input: RepertoireInput, createdBy: string | null): Promise<Repertoire> {
    const now = new Date().toISOString()
    let event: ChurchEvent
    if (input.eventId) {
      const linked = await db.list('repertoires', { eventId: input.eventId })
      if (linked.length > 0) throw new DataError('Este evento já possui um repertório.')
      event = await db.update('events', input.eventId, { ...eventFields(input), updatedAt: now })
    } else {
      event = await db.insert('events', {
        id: generateId(),
        ...eventFields(input),
        endTime: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    const repertoire = await db.insert('repertoires', {
      id: generateId(),
      eventId: event.id,
      name: input.name.trim(),
      description: input.description.trim(),
      notes: input.notes.trim(),
      status: input.status,
      createdBy,
      createdAt: now,
      updatedAt: now,
    })
    await syncSongs(repertoire.id, input)
    await notifyPublished(repertoire, event)
    return repertoire
  },

  async update(id: string, input: RepertoireInput): Promise<Repertoire> {
    const existing = await db.get('repertoires', id)
    if (!existing) throw new NotFoundError('Repertório')
    const now = new Date().toISOString()
    const event = await db.update('events', existing.eventId, { ...eventFields(input), updatedAt: now })
    const repertoire = await db.update('repertoires', id, {
      name: input.name.trim(),
      description: input.description.trim(),
      notes: input.notes.trim(),
      status: input.status,
      updatedAt: now,
    })
    await syncSongs(id, input)
    if (repertoire.status === 'published') await notifyPublished(repertoire, event, existing.status === 'draft' ? 'created' : 'updated')
    return repertoire
  },

  async setStatus(id: string, status: Repertoire['status']): Promise<void> {
    const repertoire = await db.update('repertoires', id, { status, updatedAt: new Date().toISOString() })
    const event = await db.get('events', repertoire.eventId)
    if (event && status === 'published') await notifyPublished(repertoire, event, 'created')
  },

  /** Remove o repertório e suas músicas; o evento continua no calendário */
  async remove(id: string): Promise<void> {
    const items = await db.list('repertoire_songs', { repertoireId: id })
    await Promise.all(items.map((item) => db.removeWhere('song_preparations', { repertoireSongId: item.id })))
    await db.removeWhere('repertoire_songs', { repertoireId: id })
    const rehearsals = await db.list('rehearsals', { repertoireId: id })
    await Promise.all(rehearsals.map((r) => db.update('rehearsals', r.id, { repertoireId: null })))
    await db.remove('repertoires', id)
  },
}
