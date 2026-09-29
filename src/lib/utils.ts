import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix = ''): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${random}` : random
}

/** Remove acentos e normaliza para buscas */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function matchesQuery(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = normalize(query)
  if (!q) return true
  const haystack = normalize(fields.filter(Boolean).join(' '))
  return q.split(/\s+/).every((term) => haystack.includes(term))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Hash estável de string → número (usado para cores/gradientes determinísticos) */
export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function groupBy<T, K extends string>(items: T[], getKey: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = getKey(item)
      ;(acc[key] ||= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const copy = items.slice()
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function whatsappLink(phone: string): string | null {
  const digits = onlyDigits(phone)
  if (digits.length < 10) return null
  const full = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${full}`
}

/** Lê um arquivo de imagem, redimensiona e retorna data URL (evita estourar o storage local) */
export function readImageAsDataUrl(file: File, maxSize = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Imagem inválida.'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
