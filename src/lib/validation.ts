import { isValidKey } from './music'
import { isValidUrl } from './utils'

export type Validator<T> = (value: T) => string | null

export const required =
  (message = 'Campo obrigatório'): Validator<unknown> =>
  (value) => {
    if (value === null || value === undefined) return message
    if (typeof value === 'string' && value.trim() === '') return message
    if (Array.isArray(value) && value.length === 0) return message
    return null
  }

export const minLength =
  (min: number, message?: string): Validator<string> =>
  (value) =>
    value.trim().length > 0 && value.trim().length < min ? (message ?? `Mínimo de ${min} caracteres`) : null

export const maxLength =
  (max: number, message?: string): Validator<string> =>
  (value) =>
    value.length > max ? (message ?? `Máximo de ${max} caracteres`) : null

export const url =
  (message = 'Informe uma URL válida (https://...)'): Validator<string> =>
  (value) =>
    value.trim() && !isValidUrl(value.trim()) ? message : null

export const email =
  (message = 'E-mail inválido'): Validator<string> =>
  (value) =>
    value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? message : null

export const musicalKey =
  (message = 'Tom inválido (ex.: G, F#, Bb, Em)'): Validator<string> =>
  (value) =>
    value.trim() && !isValidKey(value) ? message : null

export const numberRange =
  (min: number, max: number, message?: string): Validator<number | null | string> =>
  (value) => {
    if (value === null || value === '' || value === undefined) return null
    const n = Number(value)
    if (Number.isNaN(n) || n < min || n > max) return message ?? `Informe um valor entre ${min} e ${max}`
    return null
  }

export const time =
  (message = 'Horário inválido'): Validator<string> =>
  (value) =>
    value && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value) ? message : null

export function runValidators<T>(value: T, validators: Array<Validator<T>>): string | null {
  for (const validate of validators) {
    const error = validate(value)
    if (error) return error
  }
  return null
}

export type Schema<T> = Partial<{ [K in keyof T]: Array<Validator<T[K]>> }>

export function validateSchema<T extends object>(values: T, schema: Schema<T>): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {}
  for (const key of Object.keys(schema) as Array<keyof T>) {
    const validators = schema[key]
    if (!validators) continue
    const error = runValidators(values[key], validators)
    if (error) errors[key] = error
  }
  return errors
}
