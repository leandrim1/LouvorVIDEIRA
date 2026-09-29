import { isSupabaseConfigured } from '../config'
import { getSupabase } from '../supabaseClient'
import { LocalProvider } from './localProvider'
import type { DataProvider } from './types'

export * from './types'
export { onChange, emitChange } from './changes'
export { isSupabaseConfigured }

let providerPromise: Promise<DataProvider> | null = null

/**
 * Retorna o provedor de dados ativo.
 * - Padrão: LocalProvider (localStorage + dados de demonstração)
 * - VITE_DATA_PROVIDER=supabase + credenciais: SupabaseProvider (carregado sob demanda)
 */
export function getProvider(): Promise<DataProvider> {
  if (!providerPromise) {
    providerPromise = isSupabaseConfigured
      ? Promise.all([getSupabase(), import('./supabaseProvider')]).then(
          ([client, { SupabaseProvider }]) => new SupabaseProvider(client),
        )
      : Promise.resolve(new LocalProvider())
  }
  return providerPromise
}

/** Atalho com a mesma API do provedor, resolvido de forma preguiçosa */
export const db: DataProvider = {
  get name() {
    return isSupabaseConfigured ? ('supabase' as const) : ('local' as const)
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
