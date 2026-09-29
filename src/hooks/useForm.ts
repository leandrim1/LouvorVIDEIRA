import { useCallback, useState, type FormEvent } from 'react'
import { validateSchema, type Schema } from '@/lib/validation'

type Errors<T> = Partial<Record<keyof T, string>>
type Validate<T> = Schema<T> | ((values: T) => Errors<T>)

/** Estado de formulário com validação e foco automático no primeiro erro */
export function useForm<T extends object>(initial: T, validate: Validate<T>) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Errors<T>>({})
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(initial))

  const run = useCallback(
    (v: T): Errors<T> => {
      const result = typeof validate === 'function' ? validate(v) : validateSchema(v, validate)
      return Object.fromEntries(Object.entries(result).filter(([, msg]) => Boolean(msg))) as Errors<T>
    },
    [validate],
  )

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }, [])

  const reset = useCallback((next: T) => {
    setSnapshot(JSON.stringify(next))
    setValues(next)
    setErrors({})
  }, [])

  const handleSubmit = (onValid: (values: T) => unknown) => (event?: FormEvent) => {
    event?.preventDefault()
    const found = run(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    return onValid(values)
  }

  return {
    values,
    set,
    setValues,
    errors,
    setErrors,
    reset,
    handleSubmit,
    isDirty: JSON.stringify(values) !== snapshot,
  }
}
