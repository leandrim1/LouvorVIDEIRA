import type { TableName } from './types'

type Listener = (tables: Set<TableName>) => void

const listeners = new Set<Listener>()
let pending = new Set<TableName>()
let scheduled = false

/** Notifica (em lote) as tabelas alteradas para que as queries sejam revalidadas */
export function emitChange(...tables: TableName[]) {
  tables.forEach((t) => pending.add(t))
  if (scheduled) return
  scheduled = true
  setTimeout(() => {
    const batch = pending
    pending = new Set()
    scheduled = false
    listeners.forEach((listener) => listener(batch))
  }, 0)
}

export function onChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
