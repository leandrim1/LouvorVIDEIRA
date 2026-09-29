import { isUpcoming } from '@/lib/dates'
import type { EventDetail, MemberRole, RepertoireDetail } from '@/types'
import { db } from './db'
import { eventService } from './eventService'
import { repertoireService } from './repertoireService'

export interface DashboardData {
  nextService: EventDetail | null
  nextRepertoire: RepertoireDetail | null
  upcomingEvents: EventDetail[]
  mySchedules: Array<{ event: EventDetail; roles: MemberRole[] }>
  nextRehearsal: EventDetail | null
  stats: { songs: number; members: number; upcomingRepertoires: number; upcomingEvents: number }
}

export const dashboardService = {
  async get(memberId: string | null): Promise<DashboardData> {
    const [events, songs, members] = await Promise.all([
      eventService.listDetails(),
      db.list('songs'),
      db.list('members'),
    ])
    const upcoming = events.filter((e) => isUpcoming(e.date, e.startTime))
    const services = upcoming.filter((e) => e.type !== 'rehearsal')
    const nextService = services.find((e) => e.repertoire) ?? services[0] ?? null
    const nextRepertoire = nextService?.repertoire
      ? await repertoireService.getDetail(nextService.repertoire.id, memberId)
      : null

    const mySchedules = memberId
      ? upcoming.flatMap((event) => {
          const roles = event.schedule?.members.filter((m) => m.memberId === memberId).map((m) => m.role) ?? []
          return roles.length ? [{ event, roles }] : []
        })
      : []

    return {
      nextService,
      nextRepertoire,
      upcomingEvents: upcoming.slice(0, 8),
      mySchedules: mySchedules.slice(0, 4),
      nextRehearsal: upcoming.find((e) => e.type === 'rehearsal') ?? null,
      stats: {
        songs: songs.length,
        members: members.filter((m) => m.active).length,
        upcomingRepertoires: services.filter((e) => e.repertoire).length,
        upcomingEvents: upcoming.length,
      },
    }
  },
}
