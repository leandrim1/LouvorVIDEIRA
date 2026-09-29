/**
 * Funções puras que montam os agregados (joins) a partir das linhas das tabelas.
 * Mantidas separadas para que o provedor Supabase possa, no futuro, substituir
 * por consultas com `select('*, relacao(*)')` sem alterar a UI.
 */
import { MEMBER_ROLES } from '@/lib/constants'
import type {
  ChurchEvent,
  Member,
  Rehearsal,
  RehearsalDetail,
  Repertoire,
  RepertoireSong,
  RepertoireSummary,
  Schedule,
  ScheduleDetail,
  ScheduleMember,
  Song,
} from '@/types'

export const byEventDate = (a: ChurchEvent, b: ChurchEvent) =>
  a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)

export function buildRepertoireSummary(
  repertoire: Repertoire,
  events: ChurchEvent[],
  items: RepertoireSong[],
  songs: Song[],
): RepertoireSummary | null {
  const event = events.find((e) => e.id === repertoire.eventId)
  if (!event) return null
  const own = items.filter((i) => i.repertoireId === repertoire.id).sort((a, b) => a.position - b.position)
  return {
    ...repertoire,
    event,
    songCount: own.length,
    songTitles: own.map((i) => songs.find((s) => s.id === i.songId)?.title ?? 'Música removida'),
  }
}

export function buildScheduleDetail(
  schedule: Schedule,
  events: ChurchEvent[],
  scheduleMembers: ScheduleMember[],
  members: Member[],
): ScheduleDetail | null {
  const event = events.find((e) => e.id === schedule.eventId)
  if (!event) return null
  const list = scheduleMembers
    .filter((sm) => sm.scheduleId === schedule.id)
    .flatMap((sm) => {
      const member = members.find((m) => m.id === sm.memberId)
      return member ? [{ ...sm, member }] : []
    })
    .sort((a, b) => MEMBER_ROLES.indexOf(a.role) - MEMBER_ROLES.indexOf(b.role))
  return { ...schedule, event, members: list }
}

export function buildRehearsalDetail(
  rehearsal: Rehearsal,
  events: ChurchEvent[],
  repertoires: Repertoire[],
  items: RepertoireSong[],
  songs: Song[],
): RehearsalDetail | null {
  const event = events.find((e) => e.id === rehearsal.eventId)
  if (!event) return null
  const repertoire = rehearsal.repertoireId ? repertoires.find((r) => r.id === rehearsal.repertoireId) : undefined
  return {
    ...rehearsal,
    event,
    repertoire: repertoire ? buildRepertoireSummary(repertoire, events, items, songs) : null,
  }
}

/** Agrupa os integrantes de uma escala por função */
export function groupScheduleByRole(schedule: ScheduleDetail) {
  const groups = new Map<ScheduleMember['role'], Member[]>()
  for (const item of schedule.members) {
    const list = groups.get(item.role) ?? []
    list.push(item.member)
    groups.set(item.role, list)
  }
  return MEMBER_ROLES.filter((role) => groups.has(role)).map((role) => ({ role, members: groups.get(role)! }))
}
