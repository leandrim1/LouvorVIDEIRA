import { describe, expect, it } from 'vitest'
import { formatDayMonth, isUpcoming, nextSunday, parseISODate, relativeDayLabel, toISODate, weeksOfMonth } from '../dates'

describe('datas', () => {
  it('converte ISO sem problemas de fuso', () => {
    expect(toISODate(parseISODate('2026-10-04'))).toBe('2026-10-04')
    expect(formatDayMonth('2026-10-04')).toBe('04/10')
  })
  it('encontra o próximo domingo', () => {
    expect(toISODate(nextSunday(new Date(2026, 8, 29)))).toBe('2026-10-04')
    expect(toISODate(nextSunday(new Date(2026, 9, 4)))).toBe('2026-10-04')
  })
  it('considera o evento como próximo até 3h após o início', () => {
    const now = new Date(2026, 9, 4, 21, 30)
    expect(isUpcoming('2026-10-04', '19:00', now)).toBe(true)
    expect(isUpcoming('2026-10-04', '10:00', now)).toBe(false)
  })
  it('gera rótulos relativos', () => {
    expect(relativeDayLabel('2026-10-04', '2026-10-04')).toBe('Hoje')
    expect(relativeDayLabel('2026-10-05', '2026-10-04')).toBe('Amanhã')
    expect(relativeDayLabel('2026-10-09', '2026-10-04')).toBe('Em 5 dias')
  })
  it('lista as semanas do mês', () => {
    const weeks = weeksOfMonth(2026, 9)
    expect(weeks[0].start).toBe('2026-09-27')
    expect(weeks.at(-1)!.end >= '2026-10-31').toBe(true)
  })
})
