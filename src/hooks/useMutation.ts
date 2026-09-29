import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useToast } from '@/contexts/toast'

interface MutationOptions<TResult> {
  /** Mensagem de sucesso exibida em toast */
  success?: string | ((result: TResult) => string)
  /** Título do toast de erro */
  error?: string
  onSuccess?: (result: TResult) => void
}

/** Executa uma ação de escrita com estado de carregamento e feedback via toast */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TResult> = {},
) {
  const toast = useToast()
  const [isPending, setPending] = useState(false)
  const ref = useRef({ fn, options })
  useLayoutEffect(() => {
    ref.current = { fn, options }
  })

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      const { fn: run, options: opts } = ref.current
      setPending(true)
      try {
        const result = await run(...args)
        const message = typeof opts.success === 'function' ? opts.success(result) : opts.success
        if (message) toast.success(message)
        opts.onSuccess?.(result)
        return result
      } catch (err) {
        console.error(err)
        toast.error(opts.error ?? 'Não foi possível concluir a ação', err instanceof Error ? err.message : undefined)
        return undefined
      } finally {
        setPending(false)
      }
    },
    [toast],
  )

  return { mutate, isPending }
}
