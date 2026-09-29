import { cn } from '@/lib/utils'
import type { SearchResult } from '@/types'
import { KeyBadge } from '@/components/ui'
import { KIND_META } from './searchMeta'

interface SearchResultRowProps {
  result: SearchResult
  active?: boolean
  onSelect: (result: SearchResult) => void
  onHover?: () => void
  id?: string
}

export function SearchResultRow({ result, active, onSelect, onHover, id }: SearchResultRowProps) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onClick={() => onSelect(result)}
      onMouseMove={onHover}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3 ring-1 ring-line [&_svg]:size-4">
        {KIND_META[result.kind].icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{result.title}</span>
        <span className="block truncate text-xs text-ink-3">
          {result.subtitle}
          {result.meta && <span className="text-ink-3"> · {result.meta}</span>}
        </span>
      </span>
      {result.keyLabel && <KeyBadge value={result.keyLabel} size="sm" />}
    </button>
  )
}
