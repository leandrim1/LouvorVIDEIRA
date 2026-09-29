import { describe, expect, it } from 'vitest'
import {
  extractChords,
  isChord,
  isChordLine,
  lyricsFromSheet,
  parseChordSheet,
  preferredNotation,
  semitonesBetween,
  transposeChord,
  transposeChordLine,
  transposeKey,
  transposeSheet,
} from '../music'

describe('transposeKey', () => {
  it('sobe meio tom seguindo G → G# → A → A# → B', () => {
    const seq = ['G']
    for (let i = 0; i < 4; i++) seq.push(transposeKey(seq[seq.length - 1], 1))
    expect(seq).toEqual(['G', 'G#', 'A', 'A#', 'B'])
  })
  it('desce e dá a volta na escala', () => {
    expect(transposeKey('C', -1)).toBe('B')
    expect(transposeKey('B', 1)).toBe('C')
  })
  it('preserva tons menores e bemóis', () => {
    expect(transposeKey('Em', 2)).toBe('F#m')
    expect(transposeKey('Bb', 1)).toBe('B')
    expect(transposeKey('Bb', -1)).toBe('A')
    expect(transposeKey('Eb', 2)).toBe('F')
  })
})

describe('semitonesBetween', () => {
  it('calcula a menor distância', () => {
    expect(semitonesBetween('C', 'D')).toBe(2)
    expect(semitonesBetween('D', 'C')).toBe(-2)
    expect(semitonesBetween('G', 'F')).toBe(-2)
    expect(semitonesBetween('A', 'A')).toBe(0)
  })
})

describe('acordes', () => {
  it('reconhece acordes comuns', () => {
    for (const c of ['G', 'Am', 'F#m7', 'C9(11)', 'D/F#', 'Bbmaj7', 'E7M', 'Asus4', 'Gº', 'A7+', 'Em7(b5)']) {
      expect(isChord(c), c).toBe(true)
    }
  })
  it('não confunde palavras com acordes', () => {
    for (const w of ['Grande', 'Deus', 'Ana', 'Eu', 'amor', 'Amigo', 'Café']) expect(isChord(w), w).toBe(false)
  })
  it('transpõe raiz e baixo', () => {
    expect(transposeChord('D/F#', 2)).toBe('E/G#')
    expect(transposeChord('Am7', 3, 'sharp')).toBe('Cm7')
    expect(transposeChord('C', 10, 'flat')).toBe('Bb')
  })
  it('detecta linhas de acordes', () => {
    expect(isChordLine('G   D/F#   Em   C')).toBe(true)
    expect(isChordLine('| G  D | Em  C | x2')).toBe(true)
    expect(isChordLine('E digno de todo louvor')).toBe(false)
  })
  it('mantém o alinhamento ao transpor', () => {
    expect(transposeChordLine('G      D', 2, 'sharp')).toBe('A      E')
    expect(transposeChordLine('C   G', 1, 'sharp')).toBe('C#  G#')
  })
})

describe('parseChordSheet', () => {
  const sheet = `[Refrão]
G              D
Grande é o Senhor
Intro: G D Em C
[G]Tu és [D]bom`

  it('separa seções, acordes e letra', () => {
    const lines = parseChordSheet(sheet)
    expect(lines[0]).toEqual({ kind: 'section', text: 'Refrão' })
    expect(lines[1].kind).toBe('chords')
    expect(lines[2]).toEqual({ kind: 'lyric', text: 'Grande é o Senhor' })
    expect(lines[3]).toEqual({ kind: 'chords', text: 'G D Em C', label: 'Intro' })
    expect(lines[4]).toEqual({ kind: 'chords', text: 'G     D' })
    expect(lines[5]).toEqual({ kind: 'lyric', text: 'Tu és bom' })
  })

  it('extrai os acordes únicos transpostos', () => {
    const lines = transposeSheet(parseChordSheet(sheet), 2, preferredNotation('A'))
    expect(extractChords(lines)).toEqual(['A', 'E', 'F#m', 'D'])
  })

  it('gera a letra removendo os acordes', () => {
    expect(lyricsFromSheet(sheet)).toBe('[Refrão]\nGrande é o Senhor\nTu és bom')
  })

  it('omite seções apenas instrumentais na letra', () => {
    expect(lyricsFromSheet('[Intro]\nG D\n\n[Verso]\nG\nLinha')).toBe('[Verso]\nLinha')
  })
})

describe('preferredNotation', () => {
  it('usa bemóis em tons como F e Bb', () => {
    expect(preferredNotation('F')).toBe('flat')
    expect(preferredNotation('Bb')).toBe('flat')
    expect(preferredNotation('G')).toBe('sharp')
    expect(preferredNotation('F#')).toBe('sharp')
  })
})
