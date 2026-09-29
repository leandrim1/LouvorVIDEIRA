import { formatWeekday, isUpcoming } from '@/lib/dates'
import { generateId } from '@/lib/utils'
import type { ScheduleDetail, ScheduleInput } from '@/types'
import { DataError, NotFoundError, db } from './db'
import { notificationService } from './notificationService'
import { buildScheduleDetail, byEventDate } from './relations'

export const scheduleService = {
  async list(): Promise<ScheduleDetail[]> {
    const [schedules, events, scheduleMembers, members] = await Promise.all([
      db.list('schedules'),
      db.list('events'),
      db.list('schedule_members'),
      db.list('members'),
    ])
    return schedules
      .map((s) => buildScheduleDetail(s, events, scheduleMembers, members))
      .filter((s): s is ScheduleDetail => s !== null)
      .sort((a, b) => byEventDate(a.event, b.event))
  },

  async get(id: string): Promise<ScheduleDetail> {
    const all = await this.list()
    const schedule = all.find((s) => s.id === id)
    if (!schedule) throw new NotFoundError('Escala')
    return schedule
  },

  /** Cria ou substitui a escala de um evento e avisa os novos escalados */
  async save(input: ScheduleInput, scheduleId?: string): Promise<ScheduleDetail> {
    const now = new Date().toISOString()
    const event = await db.get('events', input.eventId)
    if (!event) throw new NotFoundError('Evento')

    let id = scheduleId
    let previousMemberIds = new Set<string>()
    if (id) {
      const previous = await db.list('schedule_members', { scheduleId: id })
      previousMemberIds = new Set(previous.map((p) => p.memberId))
      await db.update('schedules', id, { eventId: input.eventId, notes: input.notes.trim(), updatedAt: now })
      await db.removeWhere('schedule_members', { scheduleId: id })
    } else {
      const existing = await db.list('schedules', { eventId: input.eventId })
      if (existing.length > 0) throw new DataError('Este evento já possui uma escala. Edite a escala existente.')
      id = generateId()
      await db.insert('schedules', { id, eventId: input.eventId, notes: input.notes.trim(), createdAt: now, updatedAt: now })
    }

    const unique = new Map<string, { memberId: string; role: ScheduleInput['members'][number]['role'] }>()
    for (const m of input.members) unique.set(`${m.memberId}:${m.role}`, m)
    await db.insertMany(
      'schedule_members',
      [...unique.values()].map((m) => ({ id: generateId(), scheduleId: id!, memberId: m.memberId, role: m.role })),
    )

    if (isUpcoming(event.date, event.startTime)) {
      const users = await db.list('users')
      const newMembers = new Set([...unique.values()].map((m) => m.memberId).filter((mid) => !previousMemberIds.has(mid)))
      await Promise.all(
        users
          .filter((u) => u.memberId && newMembers.has(u.memberId))
          .map((u) =>
            notificationService.create({
              type: 'schedule',
              title: 'Você foi escalado',
              message: `Você foi escalado para ${formatWeekday(event.date).toLowerCase()} (${event.title}).`,
              link: `/escalas/${id}`,
              userId: u.id,
            }),
          ),
      )
    }
    return this.get(id)
  },

  async remove(id: string): Promise<void> {
    await db.removeWhere('schedule_members', { scheduleId: id })
    await db.remove('schedules', id)
  },
}
