import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CornerDownLeft, Loader2, Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useOverlay } from '@/hooks/useOverlay'
import { useQuery } from '@/hooks/useQuery'
import { MAIN_NAV } from '@/lib/navigation'
import { searchService } from '@/services'
import type { SearchResult } from '@/types'
import { SearchResultRow } from './SearchResults'
import { KIND_META, groupResults } from './searchMeta'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

const SUGGESTIONS = ['Oceanos', 'Tom C', 'Culto de Celebração', 'Maria', 'Vigília']

/** Busca global (Ctrl/⌘ + K): músicas, tons, repertórios, eventos e integrantes */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  if (!open) return null
  return <CommandPaletteDialog onClose={onClose} />
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebounce(query.trim(), 150)
  useOverlay(true, onClose, panelRef)

  const { data: results = [], isFetching } = useQuery(
    debounced ? `search:${debounced}` : null,
    () => searchService.search(debounced),
    ['songs', 'repertoires', 'events', 'members', 'repertoire_songs'],
  )

  const groups = useMemo(() => groupResults(debounced ? results : []), [results, debounced])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0))

  const select = (result: SearchResult) => {
    onClose()
    navigate(result.href)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flat[activeIndex]) select(flat[activeIndex])
      else if (query.trim()) {
        onClose()
        navigate(`/busca?q=${encodeURIComponent(query.trim())}`)
      }
    }
  }

  let index = -1
  return createPortal(
    <div data-overlay-root className="fixed inset-0 z-50 flex justify-center sm:items-start sm:px-4 sm:pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-zinc-950/50 backdrop-blur-[2px] dark:bg-black/70" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        className="relative flex h-full w-full animate-scale-in flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[70vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-line"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:py-3">
          {isFetching ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-brand-500" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
          )}
          <input
            data-autofocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar música, artista, tom, integrante, repertório…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="command-results"
            aria-activedescendant={flat[activeIndex] ? `cmd-${activeIndex}` : undefined}
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-3 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Fechar busca"
          >
            <span className="hidden sm:inline">Esc</span>
            <X className="size-4 sm:hidden" />
          </button>
        </div>

        <div ref={listRef} id="command-results" role="listbox" className="scrollbar-thin flex-1 overflow-y-auto p-2">
          {!debounced && (
            <div className="space-y-5 p-2">
              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wider text-ink-3 uppercase">Sugestões</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuery(s)}
                      className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink-2 ring-1 ring-line transition-colors hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold tracking-wider text-ink-3 uppercase">Ir para</p>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {MAIN_NAV.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        onClose()
                        navigate(item.to)
                      }}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <item.icon className="size-4 text-ink-3" aria-hidden />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {debounced && !isFetching && flat.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold text-ink">Nada encontrado para “{debounced}”</p>
              <p className="mt-1 text-sm text-ink-3">Tente outro termo, um tom (ex.: “Tom G”) ou o nome de um integrante.</p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.kind} className="mb-2" role="group" aria-label={KIND_META[group.kind].label}>
              <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-ink-3 uppercase">{KIND_META[group.kind].label}</p>
              {group.items.map((result) => {
                index++
                const i = index
                return (
                  <SearchResultRow
                    key={`${result.kind}-${result.id}`}
                    id={`cmd-${i}`}
                    result={result}
                    active={i === activeIndex}
                    onHover={() => setActive(i)}
                    onSelect={select}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {debounced && (
          <div className="pb-safe flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-3">
            <span className="hidden items-center gap-1.5 sm:flex">
              <CornerDownLeft className="size-3.5" /> abrir · ↑↓ navegar
            </span>
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate(`/busca?q=${encodeURIComponent(debounced)}`)
              }}
              className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-300"
            >
              Ver todos os resultados <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
