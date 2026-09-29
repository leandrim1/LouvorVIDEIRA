import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { onChange, type TableName } from '@/services/db'

/** Cache em memória compartilhado entre telas (stale-while-revalidate) */
const cache = new Map<string, unknown>()

export function clearQueryCache() {
  cache.clear()
}

export interface QueryResult<T> {
  data: T | undefined
  error: Error | null
  /** Primeira carga, sem dados em cache */
  isLoading: boolean
  /** Qualquer requisição em andamento (inclusive revalidação) */
  isFetching: boolean
  refetch: () => void
}

/**
 * Busca dados de um service e revalida automaticamente quando alguma das
 * tabelas informadas é alterada (por esta aba, outra aba ou Supabase Realtime).
 * Passe `key = null` para desabilitar a consulta.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, tables: TableName[]): QueryResult<T> {
  const fetcherRef = useRef(fetcher)
  useLayoutEffect(() => {
    fetcherRef.current = fetcher
  })

  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: Error | null }>(() => ({
    key,
    data: key ? (cache.get(key) as T | undefined) : undefined,
    error: null,
  }))
  // Última requisição concluída (chave#versão) — deriva o estado de carregamento sem setState no efeito
  const [settled, setSettled] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  // Troca de chave: mostra imediatamente o cache da nova chave (se houver)
  if (state.key !== key) {
    setState({ key, data: key ? (cache.get(key) as T | undefined) : undefined, error: null })
  }

  const tablesKey = tables.join(',')
  useEffect(() => {
    const watched = new Set(tablesKey.split(','))
    return onChange((changed) => {
      for (const table of changed) {
        if (watched.has(table)) {
          setVersion((v) => v + 1)
          return
        }
      }
    })
  }, [tablesKey])

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const requestId = `${key}#${version}`
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return
        cache.set(key, result)
        setState({ key, data: result, error: null })
        setSettled(requestId)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // "Não encontrado" é esperado logo após uma exclusão; demais erros são registrados
        if (!(err instanceof Error && err.name === 'NotFoundError')) console.error(`[useQuery:${key}]`, err)
        setState((prev) => ({ ...prev, error: err instanceof Error ? err : new Error(String(err)) }))
        setSettled(requestId)
      })
    return () => {
      cancelled = true
    }
  }, [key, version])

  const refetch = useCallback(() => setVersion((v) => v + 1), [])

  const data = state.key === key ? state.data : undefined
  const error = state.key === key ? state.error : null
  return {
    data,
    error,
    isLoading: key !== null && data === undefined && !error,
    isFetching: key !== null && settled !== `${key}#${version}`,
    refetch,
  }
}
