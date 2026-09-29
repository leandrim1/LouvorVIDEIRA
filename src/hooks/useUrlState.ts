import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Estado de filtros sincronizado com a URL (links compartilháveis).
 * O estado local é a fonte da verdade — evita perder alterações feitas
 * em sequência rápida antes de a navegação ser concluída.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState<T>(() => {
    const initial = { ...defaults }
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const value = params.get(key as string)
      if (value !== null) initial[key] = value as T[keyof T]
    }
    return initial
  })

  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(state)) {
          if (value && value !== defaults[key]) next.set(key, value)
          else next.delete(key)
        }
        return next.toString() === prev.toString() ? prev : next
      },
      { replace: true },
    )
    // `defaults` é estável por página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, setParams])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setState((s) => ({ ...s, [key]: value })), [])
  const reset = useCallback((keys: Array<keyof T>) => setState((s) => {
    const next = { ...s }
    for (const k of keys) next[k] = defaults[k]
    return next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  return [state, set, setState, reset] as const
}
