import { formatWeekday, isUpcoming, relativeDayLabel } from '@/lib/dates'
import { generateId } from '@/lib/utils'
import type { RehearsalDetail, RehearsalInput } from '@/types'
import { NotFoundError, db } from './db'
import { isServerMode } from './config'
import { dispatchNotification } from './pushService'
import { notificationService } from './notificationService'
import { buildRehearsalDetail, byEventDate } from './relations'

function eventFields(input: RehearsalInput) {
  return {
    title: input.title.trim() || 'Ensaio',
    type: 'rehearsal' as const,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime || null,
    location: input.location.trim(),
    description: '',
  }
}

export const rehearsalService = {
  async list(): Promise<RehearsalDetail[]> {
    const [rehearsals, events, repertoires, items, songs] = await Promise.all([
      db.list('rehearsals'),
      db.list('events'),
      db.list('repertoires'),
      db.list('repertoire_songs'),
      db.list('songs'),
    ])
    return rehearsals
      .map((r) => buildRehearsalDetail(r, events, repertoires, items, songs))
      .filter((r): r is RehearsalDetail => r !== null)
      .sort((a, b) => byEventDate(a.event, b.event))
  },

  async get(id: string): Promise<RehearsalDetail> {
    const all = await this.list()
    const rehearsal = all.find((r) => r.id === id)
    if (!rehearsal) throw new NotFoundError('Ensaio')
    return rehearsal
  },

  async create(input: RehearsalInput): Promise<void> {
    const now = new Date().toISOString()
    const event = await db.insert('events', { id: generateId(), ...eventFields(input), createdAt: now, updatedAt: now })
    const rehearsal = await db.insert('rehearsals', {
      id: generateId(),
      eventId: event.id,
      repertoireId: input.repertoireId,
      notes: input.notes.trim(),
      createdAt: now,
      updatedAt: now,
    })
    if (isServerMode) {
      dispatchNotification('REHEARSAL_CREATED', rehearsal.id)
    } else if (isUpcoming(event.date, event.startTime)) {
      const when = relativeDayLabel(event.date)
      const day = when === 'Amanhã' || when === 'Hoje' ? when.toLowerCase() : formatWeekday(event.date).toLowerCase()
      await notificationService.create({
        type: 'rehearsal',
        title: 'Ensaio agendado',
        message: `Ensaio ${day} às ${event.startTime}.`,
        link: '/ensaios',
      })
    }
  },

  async update(id: string, input: RehearsalInput): Promise<void> {
    const rehearsal = await db.get('rehearsals', id)
    if (!rehearsal) throw new NotFoundError('Ensaio')
    const now = new Date().toISOString()
    await db.update('events', rehearsal.eventId, { ...eventFields(input), updatedAt: now })
    await db.update('rehearsals', id, { repertoireId: input.repertoireId, notes: input.notes.trim(), updatedAt: now })
    dispatchNotification('REHEARSAL_UPDATED', id)
  },

  /** Remove o ensaio e o evento correspondente no calendário */
  async remove(id: string): Promise<void> {
    const rehearsal = await db.get('rehearsals', id)
    if (!rehearsal) return
    await db.remove('rehearsals', id)
    await db.remove('events', rehearsal.eventId)
  },
}
