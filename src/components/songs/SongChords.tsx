import { useMemo, type ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { isChord, parseChordSheet, preferredNotation, semitonesBetween, transposeSheet, type SheetLine } from '@/lib/music'
import { EmptyState } from '@/components/ui'
import { KeySelector } from './KeySelector'
import { ReaderFrame } from './ReaderFrame'

/** Destaca os acordes preservando os espaços (alinhamento com a letra) */
function ChordLine({ text, label }: { text: string; label?: string }) {
  const parts = text.split(/(\s+)/)
  return (
    <div className="font-mono leading-[1.35] font-bold whitespace-pre text-chord">
      {label && <span className="mr-2 font-sans text-[0.8em] font-semibold text-ink-3">{label}:</span>}
      {parts.map((part, i) => (isChord(part) ? <span key={i}>{part}</span> : <span key={i} className="text-ink-3">{part}</span>))}
    </div>
  )
}

export function SheetView({ lines, fontSize }: { lines: SheetLine[]; fontSize: number }) {
  const nodes: ReactNode[] = []
  lines.forEach((line, i) => {
    if (line.kind === 'section') {
      nodes.push(
        <p key={i} className="mt-6 mb-1.5 font-sans text-[0.72em] font-bold tracking-[0.12em] text-brand-600 uppercase first:mt-0 dark:text-brand-300">
          {line.text}
        </p>,
      )
    } else if (line.kind === 'chords') {
      nodes.push(<ChordLine key={i} text={line.text} label={line.label} />)
    } else if (line.kind === 'lyric') {
      nodes.push(
        <div key={i} className="mb-1.5 font-mono leading-[1.35] whitespace-pre text-ink">
          {line.text}
        </div>,
      )
    } else {
      nodes.push(<div key={i} className="h-[0.9em]" aria-hidden />)
    }
  })
  return (
    <div style={{ fontSize }} className="min-w-max">
      {nodes}
    </div>
  )
}

interface SongChordsProps {
  sheet: string
  /** Tom em que a cifra foi escrita */
  originalKey: string
  /** Tom a ser exibido (transposição automática) */
  displayKey: string
  onKeyChange?: (key: string) => void
  title: string
  subtitle?: string
}

export function SongChords({ sheet, originalKey, displayKey, onKeyChange, title, subtitle }: SongChordsProps) {
  const lines = useMemo(() => {
    const parsed = parseChordSheet(sheet)
    const steps = semitonesBetween(originalKey, displayKey)
    return transposeSheet(parsed, steps, preferredNotation(displayKey))
  }, [sheet, originalKey, displayKey])

  if (!sheet.trim()) {
    return <EmptyState compact icon={<FileText />} title="Cifra não cadastrada" description="Edite a música para adicionar a cifra." />
  }

  return (
    <ReaderFrame
      title={title}
      subtitle={subtitle ? `${subtitle} · Tom ${displayKey}` : `Tom ${displayKey}`}
      storageKey="chords"
      defaultFontSize={15}
      controls={onKeyChange ? <KeySelector value={displayKey} onChange={onKeyChange} label="Tom da cifra" /> : undefined}
    >
      {(fontSize) => <SheetView lines={lines} fontSize={fontSize} />}
    </ReaderFrame>
  )
}
