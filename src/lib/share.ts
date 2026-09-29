import { MEMBER_ROLE_LABELS } from './constants'
import { formatDateShort, formatTime, formatWeekday } from './dates'
import { groupScheduleByRole } from '@/services/relations'
import type { RepertoireDetail } from '@/types'

/** Texto do repertório formatado para WhatsApp/Telegram */
export function repertoireToText(repertoire: RepertoireDetail, url?: string): string {
  const { event } = repertoire
  const lines = [
    `*${repertoire.name.toUpperCase()}*`,
    `${formatWeekday(event.date)}, ${formatDateShort(event.date)} às ${formatTime(event.startTime)}`,
    event.location ? `📍 ${event.location}` : '',
    '',
    '*Músicas*',
    ...repertoire.songs.map(
      (s, i) =>
        `${String(i + 1).padStart(2, '0')}. ${s.song.title} — Tom ${s.key}${s.leadVocal ? ` (${s.leadVocal.name.split(' ')[0]})` : ''}`,
    ),
  ]
  if (repertoire.schedule) {
    lines.push('', '*Escala*')
    for (const { role, members } of groupScheduleByRole(repertoire.schedule)) {
      lines.push(`${MEMBER_ROLE_LABELS[role]}: ${members.map((m) => m.name.split(' ')[0]).join(', ')}`)
    }
  }
  if (repertoire.notes) lines.push('', `📝 ${repertoire.notes}`)
  if (url) lines.push('', url)
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
