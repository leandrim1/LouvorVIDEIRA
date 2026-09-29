import { Minus, Plus, RotateCcw } from 'lucide-react'
import { formatSemitones, semitonesBetween, transposeKey } from '@/lib/music'
import { cn } from '@/lib/utils'

interface KeySelectorProps {
  value: string
  onChange: (key: string) => void
  /** Referência para exibir a distância em semitons e permitir "voltar" */
  referenceKey?: string
  referenceLabel?: string
  size?: 'md' | 'lg'
  className?: string
  label?: string
}

/** Controle rápido de transposição:  [ - ]  G  [ + ] */
export function KeySelector({
  value,
  onChange,
  referenceKey,
  referenceLabel = 'tom original',
  size = 'md',
  className,
  label = 'Tom',
}: KeySelectorProps) {
  const steps = referenceKey ? semitonesBetween(referenceKey, value) : 0
  const btn = cn(
    'flex items-center justify-center rounded-xl bg-surface text-ink ring-1 ring-line transition-all ring-inset hover:bg-surface-2 active:scale-95',
    size === 'lg' ? 'size-12 [&_svg]:size-5' : 'size-10 [&_svg]:size-4',
  )
  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="flex items-center gap-2" role="group" aria-label={`${label}: ${value}`}>
        <button type="button" className={btn} onClick={() => onChange(transposeKey(value, -1))} aria-label="Baixar meio tom">
          <Minus />
        </button>
        <output
          aria-live="polite"
          className={cn(
            'flex items-center justify-center rounded-xl bg-brand-600/[0.08] font-mono font-bold text-brand-700 ring-1 ring-brand-600/15 ring-inset dark:bg-leaf-400/10 dark:text-leaf-300 dark:ring-leaf-300/20',
            size === 'lg' ? 'h-12 min-w-20 px-3 text-2xl' : 'h-10 min-w-16 px-2.5 text-lg',
          )}
        >
          {value}
        </output>
        <button type="button" className={btn} onClick={() => onChange(transposeKey(value, 1))} aria-label="Subir meio tom">
          <Plus />
        </button>
      </div>
      {referenceKey && (
        <div className="flex h-5 items-center gap-1.5 text-xs text-ink-3">
          <span className="tabular">{steps === 0 ? `No ${referenceLabel}` : formatSemitones(steps)}</span>
          {steps !== 0 && (
            <button
              type="button"
              onClick={() => onChange(referenceKey)}
              className="inline-flex items-center gap-1 rounded-md px-1 font-semibold text-brand-600 hover:underline dark:text-brand-300"
            >
              <RotateCcw className="size-3" aria-hidden /> {referenceKey}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
