/**
 * Utilitários de data. Datas de eventos são armazenadas como `YYYY-MM-DD` (sem fuso)
 * e horários como `HH:mm`, sempre interpretados no fuso local do dispositivo.
 */

const LOCALE = 'pt-BR'

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function combineDateTime(date: string, time: string | null | undefined): Date {
  const base = parseISODate(date)
  if (time) {
    const [h, min] = time.split(':').map(Number)
    base.setHours(h ?? 0, min ?? 0, 0, 0)
  }
  return base
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function addDaysISO(date: string, days: number): string {
  return toISODate(addDays(parseISODate(date), days))
}

export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth() + months, 1)
  return copy
}

export function startOfWeek(date: Date): Date {
  // Semana começando no domingo (padrão brasileiro de calendário)
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isToday(date: string): boolean {
  return date === todayISO()
}

export function isBetween(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

export function diffInDays(from: string, to: string): number {
  const a = parseISODate(from).getTime()
  const b = parseISODate(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Evento ainda é considerado "próximo" até 3h após o início */
export function isUpcoming(date: string, time: string | null, now = new Date()): boolean {
  const start = combineDateTime(date, time ?? '23:59')
  return start.getTime() + 3 * 60 * 60 * 1000 >= now.getTime()
}

export function isPast(date: string, time: string | null, now = new Date()): boolean {
  return !isUpcoming(date, time, now)
}

/** Próximo domingo a partir de hoje (inclui hoje se for domingo) */
export function nextSunday(from = new Date()): Date {
  const copy = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const offset = (7 - copy.getDay()) % 7
  copy.setDate(copy.getDate() + offset)
  return copy
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, options)

const weekdayLong = fmt({ weekday: 'long' })
const weekdayShort = fmt({ weekday: 'short' })
const monthLong = fmt({ month: 'long' })
const monthShort = fmt({ month: 'short' })
const fullDate = fmt({ day: '2-digit', month: 'long', year: 'numeric' })
const longDate = fmt({ weekday: 'long', day: '2-digit', month: 'long' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const clean = (s: string) => s.replace('.', '')

export const formatWeekday = (date: string) => capitalize(weekdayLong.format(parseISODate(date)))
export const formatWeekdayShort = (date: string) => capitalize(clean(weekdayShort.format(parseISODate(date))))
export const formatMonth = (date: string) => capitalize(monthLong.format(parseISODate(date)))
export const formatMonthShort = (date: string) => clean(monthShort.format(parseISODate(date))).toUpperCase()
export const formatDay = (date: string) => String(parseISODate(date).getDate()).padStart(2, '0')

/** 04/10 */
export function formatDayMonth(date: string): string {
  const d = parseISODate(date)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 04/10/2026 */
export function formatDateShort(date: string): string {
  const d = parseISODate(date)
  return `${formatDayMonth(date)}/${d.getFullYear()}`
}

/** 04 de outubro de 2026 */
export const formatDateLong = (date: string) => fullDate.format(parseISODate(date))

/** Domingo, 04 de outubro */
export const formatDateWithWeekday = (date: string) => capitalize(longDate.format(parseISODate(date)))

/** OUTUBRO 2026 */
export function formatMonthYear(date: Date): string {
  return `${capitalize(monthLong.format(date))} ${date.getFullYear()}`
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  return time.slice(0, 5)
}

export function formatTimeRange(start: string, end: string | null): string {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)
}

/** "Hoje", "Amanhã", "Em 3 dias", "Há 2 dias" */
export function relativeDayLabel(date: string, today = todayISO()): string {
  const diff = diffInDays(today, date)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  if (diff > 1 && diff < 7) return `Em ${diff} dias`
  if (diff < -1 && diff > -7) return `Há ${Math.abs(diff)} dias`
  if (diff >= 7 && diff < 14) return 'Próxima semana'
  return formatDateShort(date)
}

/** "agora", "há 5 min", "há 2 h", "ontem", "12/09" */
export function timeAgo(iso: string, now = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return formatDayMonth(toISODate(new Date(iso)))
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function monthNames(): string[] {
  return Array.from({ length: 12 }, (_, i) => capitalize(monthLong.format(new Date(2026, i, 1))))
}

/** Semanas (domingo a sábado) que intersectam um mês */
export function weeksOfMonth(year: number, month: number): Array<{ start: string; end: string; label: string }> {
  const first = new Date(year, month, 1)
  const last = endOfMonth(first)
  const weeks: Array<{ start: string; end: string; label: string }> = []
  let cursor = startOfWeek(first)
  while (cursor <= last) {
    const end = addDays(cursor, 6)
    const start = toISODate(cursor)
    const endIso = toISODate(end)
    weeks.push({ start, end: endIso, label: `${formatDayMonth(start)} – ${formatDayMonth(endIso)}` })
    cursor = addDays(cursor, 7)
  }
  return weeks
}

/** Matriz 6x7 de dias para o calendário mensal */
export function monthMatrix(year: number, month: number): Date[] {
  const start = startOfWeek(new Date(year, month, 1))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
