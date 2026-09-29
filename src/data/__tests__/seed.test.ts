import { describe, expect, it } from 'vitest'
import { createSeed } from '../seed'

describe('dados de demonstração', () => {
  const db = createSeed(new Date(2026, 8, 29, 12))

  it('atende aos mínimos pedidos', () => {
    expect(db.songs.length).toBeGreaterThanOrEqual(15)
    expect(db.members.length).toBeGreaterThanOrEqual(8)
    expect(db.repertoires.length).toBeGreaterThanOrEqual(4)
    expect(db.rehearsals.length).toBeGreaterThanOrEqual(3)
    expect(db.events.length).toBeGreaterThanOrEqual(5)
  })

  it('mantém a integridade referencial', () => {
    const ids = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id))
    const events = ids(db.events)
    const songs = ids(db.songs)
    const members = ids(db.members)
    const repertoires = ids(db.repertoires)
    const schedules = ids(db.schedules)
    const repertoireSongs = ids(db.repertoire_songs)
    db.repertoires.forEach((r) => expect(events.has(r.eventId)).toBe(true))
    db.repertoire_songs.forEach((rs) => {
      expect(repertoires.has(rs.repertoireId)).toBe(true)
      expect(songs.has(rs.songId)).toBe(true)
      if (rs.leadVocalId) expect(members.has(rs.leadVocalId)).toBe(true)
    })
    db.schedules.forEach((s) => expect(events.has(s.eventId)).toBe(true))
    db.schedule_members.forEach((sm) => {
      expect(schedules.has(sm.scheduleId)).toBe(true)
      expect(members.has(sm.memberId)).toBe(true)
    })
    db.rehearsals.forEach((r) => {
      expect(events.has(r.eventId)).toBe(true)
      if (r.repertoireId) expect(repertoires.has(r.repertoireId)).toBe(true)
    })
    db.song_preparations.forEach((p) => expect(repertoireSongs.has(p.repertoireSongId)).toBe(true))
    db.song_videos.forEach((v) => expect(songs.has(v.songId)).toBe(true))
  })

  it('agenda o próximo culto para o domingo seguinte', () => {
    const next = db.events.find((e) => e.type === 'service' && e.date === '2026-10-04' && e.startTime === '19:00')
    expect(next).toBeDefined()
    expect(db.repertoires.some((r) => r.eventId === next!.id)).toBe(true)
  })

  it('usa ids no formato UUID (compatível com o PostgreSQL)', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    for (const table of Object.values(db)) for (const row of table as Array<{ id: string }>) expect(row.id).toMatch(uuid)
  })
})
