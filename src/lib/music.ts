/**
 * Teoria musical básica: tonalidades, transposição e leitura de cifras
 * no formato "acordes sobre a letra" (padrão Cifra Club) e ChordPro inline ([G]Letra).
 */

export type Notation = 'sharp' | 'flat'

export const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}

/** Tons naturais que convencionalmente usam bemóis */
const FLAT_KEYS = new Set(['F', 'Dm', 'Gm', 'Cm', 'Fm'])

export interface ParsedKey {
  root: string
  index: number
  minor: boolean
}

const KEY_REGEX = /^([A-G])(#|b)?(m)?$/

export function parseKey(key: string | null | undefined): ParsedKey | null {
  if (!key) return null
  const match = key.trim().match(KEY_REGEX)
  if (!match) return null
  const root = match[1] + (match[2] ?? '')
  const index = NOTE_INDEX[root]
  if (index === undefined) return null
  return { root, index, minor: Boolean(match[3]) }
}

export function isValidKey(key: string): boolean {
  return parseKey(key) !== null
}

export function noteName(index: number, notation: Notation = 'sharp'): string {
  const i = ((index % 12) + 12) % 12
  return notation === 'flat' ? FLAT_NOTES[i] : SHARP_NOTES[i]
}

/** Notação preferida para escrever acordes num tom */
export function preferredNotation(key: string): Notation {
  const parsed = parseKey(key)
  if (!parsed) return 'sharp'
  if (parsed.root.includes('b')) return 'flat'
  if (parsed.root.includes('#')) return 'sharp'
  return FLAT_KEYS.has(key.trim()) ? 'flat' : 'sharp'
}

/** G → G# → A → A# ... (mantém "m" de tons menores) */
export function transposeKey(key: string, steps: number, notation?: Notation): string {
  const parsed = parseKey(key)
  if (!parsed) return key
  const style: Notation = notation ?? (parsed.root.includes('b') ? 'flat' : 'sharp')
  return noteName(parsed.index + steps, style) + (parsed.minor ? 'm' : '')
}

/** Distância em semitons (normalizada para -5..+6) */
export function semitonesBetween(from: string, to: string): number {
  const a = parseKey(from)
  const b = parseKey(to)
  if (!a || !b) return 0
  const diff = (((b.index - a.index) % 12) + 12) % 12
  return diff > 6 ? diff - 12 : diff
}

export function formatSemitones(steps: number): string {
  if (steps === 0) return 'Tom original'
  const abs = Math.abs(steps)
  const unit = abs === 1 ? 'semitom' : 'semitons'
  return `${steps > 0 ? '+' : '−'}${abs} ${unit}`
}

/** Lista de tons para selects: C, C#, D ... + menores */
export function keyOptions(notation: Notation = 'sharp'): string[] {
  const majors = Array.from({ length: 12 }, (_, i) => noteName(i, notation))
  return [...majors, ...majors.map((n) => `${n}m`)]
}

/* ------------------------------------------------------------------ */
/* Acordes                                                             */
/* ------------------------------------------------------------------ */

const CHORD_REGEX =
  /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|°|º|\+|-|\d|#|b|\(|\)|,)*)(?:\/([A-G](?:#|b)?))?$/

/** Tokens aceitos em linhas de acordes que não são acordes (repetições, compassos) */
const CHORD_LINE_EXTRAS = /^(\|+|:?\|\|?:?|x\d+|\(?\d+x\)?|\(|\)|-+|\.+|%|\/|→|>)$/i

export function isChord(token: string): boolean {
  return CHORD_REGEX.test(token)
}

export function transposeChord(chord: string, steps: number, notation: Notation = 'sharp'): string {
  const match = chord.match(CHORD_REGEX)
  if (!match) return chord
  const [, root, suffix = '', bass] = match
  const rootIndex = NOTE_INDEX[root]
  if (rootIndex === undefined) return chord
  const newRoot = noteName(rootIndex + steps, notation)
  const newBass = bass !== undefined ? noteName((NOTE_INDEX[bass] ?? 0) + steps, notation) : undefined
  return newRoot + suffix + (newBass ? `/${newBass}` : '')
}

export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  let chords = 0
  for (const token of tokens) {
    if (isChord(token)) chords++
    else if (!CHORD_LINE_EXTRAS.test(token)) return false
  }
  return chords > 0
}

/** Transpõe uma linha de acordes preservando o alinhamento com a letra */
export function transposeChordLine(line: string, steps: number, notation: Notation): string {
  if (steps === 0) return line
  let result = ''
  const regex = /\S+/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(line)) !== null) {
    const token = match[0]
    const replaced = isChord(token) ? transposeChord(token, steps, notation) : token
    const targetColumn = match.index
    if (result.length < targetColumn) result += ' '.repeat(targetColumn - result.length)
    else if (result.length > 0) result += ' '
    result += replaced
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Parser de cifra                                                     */
/* ------------------------------------------------------------------ */

export type SheetLine =
  | { kind: 'section'; text: string }
  | { kind: 'chords'; text: string; label?: string }
  | { kind: 'lyric'; text: string }
  | { kind: 'empty' }

const SECTION_BRACKET = /^\[([^\]]+)\]$/
const SECTION_COLON = /^([A-Za-zÀ-ú0-9ºª ]{2,24}):$/
const LABELED_CHORDS = /^(\[[^\]]+\]|[A-Za-zÀ-ú ]{2,16}:)\s+(.+)$/
const INLINE_CHORD = /\[([^\]\s]+)\]/g

function convertInlineChords(line: string): { chords: string; lyric: string } | null {
  if (!line.includes('[')) return null
  let lyric = ''
  let chords = ''
  let lastIndex = 0
  let found = false
  INLINE_CHORD.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_CHORD.exec(line)) !== null) {
    if (!isChord(match[1])) continue
    found = true
    lyric += line.slice(lastIndex, match.index)
    const column = lyric.length
    if (chords.length < column) chords += ' '.repeat(column - chords.length)
    else if (chords.length > 0) chords += ' '
    chords += match[1]
    lastIndex = match.index + match[0].length
  }
  if (!found) return null
  lyric += line.slice(lastIndex)
  return { chords, lyric }
}

export function parseChordSheet(sheet: string): SheetLine[] {
  const lines: SheetLine[] = []
  for (const raw of sheet.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\t/g, '    ').replace(/\s+$/, '')
    const trimmed = line.trim()
    if (!trimmed) {
      lines.push({ kind: 'empty' })
      continue
    }
    const bracket = trimmed.match(SECTION_BRACKET)
    if (bracket && !isChord(bracket[1])) {
      lines.push({ kind: 'section', text: bracket[1] })
      continue
    }
    const colon = trimmed.match(SECTION_COLON)
    if (colon) {
      lines.push({ kind: 'section', text: colon[1] })
      continue
    }
    if (isChordLine(line)) {
      lines.push({ kind: 'chords', text: line })
      continue
    }
    const labeled = trimmed.match(LABELED_CHORDS)
    if (labeled && isChordLine(labeled[2])) {
      const label = labeled[1].replace(/[[\]:]/g, '').trim()
      lines.push({ kind: 'chords', text: labeled[2], label })
      continue
    }
    const inline = convertInlineChords(line)
    if (inline) {
      lines.push({ kind: 'chords', text: inline.chords })
      lines.push({ kind: 'lyric', text: inline.lyric })
      continue
    }
    lines.push({ kind: 'lyric', text: line })
  }
  return lines
}

export function transposeSheet(lines: SheetLine[], steps: number, notation: Notation): SheetLine[] {
  return lines.map((line) =>
    line.kind === 'chords' ? { ...line, text: transposeChordLine(line.text, steps, notation) } : line,
  )
}

/** Acordes únicos usados na cifra (na ordem em que aparecem) */
export function extractChords(lines: SheetLine[]): string[] {
  const seen = new Set<string>()
  for (const line of lines) {
    if (line.kind !== 'chords') continue
    for (const token of line.text.split(/\s+/)) {
      if (isChord(token)) seen.add(token)
    }
  }
  return [...seen]
}

/** Gera a letra "limpa" a partir da cifra (remove linhas de acordes e seções só instrumentais) */
export function lyricsFromSheet(sheet: string): string {
  const out: string[] = []
  let pendingSection: string | null = null
  for (const line of parseChordSheet(sheet)) {
    if (line.kind === 'chords') continue
    if (line.kind === 'section') {
      pendingSection = `[${line.text}]`
    } else if (line.kind === 'lyric') {
      if (pendingSection) {
        if (out.length && out[out.length - 1] !== '') out.push('')
        out.push(pendingSection)
        pendingSection = null
      }
      out.push(line.text.trim())
    } else if (out.length && out[out.length - 1] !== '') {
      out.push('')
    }
  }
  return out.join('\n').trim()
}
