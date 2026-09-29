import { generateId } from '@/lib/utils'
import type { ChurchEvent, EventDetail, EventInput } from '@/types'
import { NotFoundError, db } from './db'
import { buildRepertoireSummary, buildScheduleDetail, byEventDate } from './relations'
import { repertoireService } from './repertoireService'

export const eventService = {
  async list(): Promise<ChurchEvent[]> {
    const events = await db.list('events')
    return events.sort(byEventDate)
  },

  /** Eventos com repertório, escala e ensaio vinculados */
  async listDetails(): Promise<EventDetail[]> {
    const [events, repertoires, items, songs, schedules, scheduleMembers, members, rehearsals] = await Promise.all([
      db.list('events'),
      db.list('repertoires'),
      db.list('repertoire_songs'),
      db.list('songs'),
      db.list('schedules'),
      db.list('schedule_members'),
      db.list('members'),
      db.list('rehearsals'),
    ])
    return events.sort(byEventDate).map((event) => {
      const rehearsal = rehearsals.find((r) => r.eventId === event.id) ?? null
      // Ensaios exibem o repertório que será ensaiado
      const repertoire =
        repertoires.find((r) => r.eventId === event.id) ??
        (rehearsal?.repertoireId ? repertoires.find((r) => r.id === rehearsal.repertoireId) : undefined)
      const schedule = schedules.find((s) => s.eventId === event.id)
      return {
        ...event,
        repertoire: repertoire ? buildRepertoireSummary(repertoire, events, items, songs) : null,
        schedule: schedule ? buildScheduleDetail(schedule, events, scheduleMembers, members) : null,
        rehearsal,
      }
    })
  },

  async getDetail(id: string): Promise<EventDetail> {
    const all = await this.listDetails()
    const event = all.find((e) => e.id === id)
    if (!event) throw new NotFoundError('Evento')
    return event
  },

  async create(input: EventInput): Promise<ChurchEvent> {
    const now = new Date().toISOString()
    return db.insert('events', { ...input, title: input.title.trim(), id: generateId(), createdAt: now, updatedAt: now })
  },

  async update(id: string, input: EventInput): Promise<ChurchEvent> {
    return db.update('events', id, { ...input, title: input.title.trim(), updatedAt: new Date().toISOString() })
  },

  /** Exclui o evento com repertório, escala e ensaio vinculados */
  async remove(id: string): Promise<void> {
    const [repertoires, schedules] = await Promise.all([
      db.list('repertoires', { eventId: id }),
      db.list('schedules', { eventId: id }),
    ])
    await Promise.all(repertoires.map((r) => repertoireService.remove(r.id)))
    await Promise.all(
      schedules.map(async (s) => {
        await db.removeWhere('schedule_members', { scheduleId: s.id })
        await db.remove('schedules', s.id)
      }),
    )
    await db.removeWhere('rehearsals', { eventId: id })
    await db.remove('events', id)
  },
}
