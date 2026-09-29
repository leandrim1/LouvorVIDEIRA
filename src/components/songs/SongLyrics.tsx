import { useMemo } from 'react'
import { ScrollText } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { ReaderFrame } from './ReaderFrame'

interface SongLyricsProps {
  lyrics: string
  title: string
  subtitle?: string
}

type Block = { type: 'section'; text: string } | { type: 'stanza'; lines: string[] }

function toBlocks(lyrics: string): Block[] {
  const blocks: Block[] = []
  let stanza: string[] = []
  const flush = () => {
    if (stanza.length) blocks.push({ type: 'stanza', lines: stanza })
    stanza = []
  }
  for (const raw of lyrics.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const section = line.match(/^\[([^\]]+)\]$/)
    if (section) {
      flush()
      blocks.push({ type: 'section', text: section[1] })
    } else if (!line) flush()
    else stanza.push(line)
  }
  flush()
  return blocks
}

/** Letra em fonte proporcional, confortável para leitura no celular */
export function SongLyrics({ lyrics, title, subtitle }: SongLyricsProps) {
  const blocks = useMemo(() => toBlocks(lyrics), [lyrics])

  if (!lyrics.trim()) {
    return <EmptyState compact icon={<ScrollText />} title="Letra não cadastrada" description="Edite a música para adicionar a letra." />
  }

  return (
    <ReaderFrame title={title} subtitle={subtitle} storageKey="lyrics" defaultFontSize={19}>
      {(fontSize) => (
        <div style={{ fontSize }} className="max-w-2xl leading-[1.6] text-ink">
          {blocks.map((block, i) =>
            block.type === 'section' ? (
              <p key={i} className="mt-7 mb-2 text-[0.68em] font-bold tracking-[0.12em] text-brand-600 uppercase first:mt-0 dark:text-brand-300">
                {block.text}
              </p>
            ) : (
              <p key={i} className="mb-5 font-medium">
                {block.lines.map((line, j) => (
                  <span key={j} className="block">
                    {line}
                  </span>
                ))}
              </p>
            ),
          )}
        </div>
      )}
    </ReaderFrame>
  )
}
