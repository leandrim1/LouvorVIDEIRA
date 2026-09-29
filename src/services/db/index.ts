import { isServerMode } from '../config'
import { ApiProvider } from './apiProvider'
import type { DataProvider } from './types'

export * from './types'
export { onChange, emitChange } from './changes'
export { isServerMode }

let providerPromise: Promise<DataProvider> | null = null

/**
 * Retorna o provedor de dados ativo.
 * - Padrão: ApiProvider (React → /api → Drizzle → Neon PostgreSQL)
 * - VITE_DATA_PROVIDER=demo: LocalProvider (dados fictícios no navegador, carregado sob demanda)
 */
export function getProvider(): Promise<DataProvider> {
  providerPromise ??= isServerMode
    ? Promise.resolve(new ApiProvider())
    : import('./localProvider').then(({ LocalProvider }) => new LocalProvider())
  return providerPromise
}

/** Atalho com a mesma API do provedor, resolvido de forma preguiçosa */
export const db: DataProvider = {
  get name() {
    return isServerMode ? ('api' as const) : ('local' as const)
  },
  list: (table, filter) => getProvider().then((p) => p.list(table, filter)),
  get: (table, id) => getProvider().then((p) => p.get(table, id)),
  insert: (table, row) => getProvider().then((p) => p.insert(table, row)),
  insertMany: (table, rows) => getProvider().then((p) => p.insertMany(table, rows)),
  update: (table, id, patch) => getProvider().then((p) => p.update(table, id, patch)),
  remove: (table, id) => getProvider().then((p) => p.remove(table, id)),
  removeWhere: (table, filter) => getProvider().then((p) => p.removeWhere(table, filter)),
  reset: () => getProvider().then((p) => p.reset()),
  exportAll: () => getProvider().then((p) => p.exportAll()),
}
