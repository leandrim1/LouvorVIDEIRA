import { useNavigate, useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/hooks/useQuery'
import { searchService } from '@/services'
import { EmptyState, ErrorState, PageHeader, SearchBar, SkeletonList } from '@/components/ui'
import { SearchResultRow } from '@/components/search/SearchResults'
import { KIND_META, groupResults } from '@/components/search/searchMeta'

export default function SearchPage() {
  useDocumentTitle('Busca')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const debounced = useDebounce(query.trim(), 200)
  const { data = [], isLoading, error, refetch } = useQuery(
    debounced ? `search:${debounced}` : null,
    () => searchService.search(debounced),
    ['songs', 'repertoires', 'events', 'members', 'repertoire_songs'],
  )
  const groups = groupResults(data)

  return (
    <div className="animate-fade-up">
      <PageHeader title="Busca" description="Músicas, artistas, tons, integrantes, repertórios e eventos." />
      <SearchBar
        value={query}
        onChange={(v) => setParams(v ? { q: v } : {}, { replace: true })}
        placeholder="Ex.: Oceanos, Tom C, Maria, Vigília…"
        size="lg"
        autoFocus
        className="mb-6"
      />
      {!debounced ? (
        <p className="text-sm text-ink-3">Digite para pesquisar em toda a aplicação.</p>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList count={4} />
      ) : groups.length === 0 ? (
        <EmptyState icon={<SearchX />} title={`Nada encontrado para “${debounced}”`} description="Tente outro termo ou busque por um tom, como “Tom G”." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.kind} aria-labelledby={`group-${group.kind}`}>
              <h2 id={`group-${group.kind}`} className="mb-2 text-xs font-extrabold tracking-[0.14em] text-ink-3 uppercase">
                {KIND_META[group.kind].label} · {group.items.length}
              </h2>
              <div className="rounded-2xl border border-line bg-surface p-1.5" role="listbox" aria-label={KIND_META[group.kind].label}>
                {group.items.map((r) => (
                  <SearchResultRow key={`${r.kind}-${r.id}`} result={r} onSelect={(res) => navigate(res.href)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
