import type { DatabaseState } from '@/data/seed'

/** Mapa tabela → tipo da linha. Mantém os serviços independentes do provedor. */
export type TableMap = { [K in keyof DatabaseState]: DatabaseState[K][number] }
export type TableName = keyof TableMap
export type Row<T extends TableName> = TableMap[T]
export type Filter<T extends TableName> = Partial<Row<T>>

export const TABLES: TableName[] = [
  'users',
  'members',
  'songs',
  'song_videos',
  'song_links',
  'song_notes',
  'favorites',
  'song_views',
  'events',
  'repertoires',
  'repertoire_songs',
  'schedules',
  'schedule_members',
  'rehearsals',
  'song_preparations',
  'notifications',
]

/**
 * Contrato de acesso a dados. Implementado por:
 *  - LocalProvider: localStorage (modo demonstração / offline)
 *  - SupabaseProvider: Postgres via supabase-js
 */
export interface DataProvider {
  readonly name: 'local' | 'supabase'
  list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]>
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>
  insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<Row<T>[]>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  remove<T extends TableName>(table: T, id: string): Promise<void>
  removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void>
  /** Apaga tudo e recarrega os dados de demonstração */
  reset(): Promise<void>
  exportAll(): Promise<Partial<DatabaseState>>
}

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} não encontrado(a).`)
    this.name = 'NotFoundError'
  }
}

export class DataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataError'
  }
}

export function matchesFilter<T extends object>(row: T, filter?: Partial<T>): boolean {
  if (!filter) return true
  return (Object.keys(filter) as Array<keyof T>).every((key) => row[key] === filter[key])
}
