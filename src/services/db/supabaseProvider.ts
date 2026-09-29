import type { SupabaseClient } from '@supabase/supabase-js'
import { createSeed, type DatabaseState } from '@/data/seed'
import { emitChange } from './changes'
import { DataError, TABLES, type DataProvider, type Filter, type Row, type TableName } from './types'

/* camelCase (app) ↔ snake_case (Postgres) */
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

function mapKeys<T>(obj: Record<string, unknown>, fn: (k: string) => string): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), v])) as T
}

const fromDb = <T>(row: Record<string, unknown>) => mapKeys<T>(row, toCamel)
const toDb = (row: object) => mapKeys<Record<string, unknown>>(row as Record<string, unknown>, toSnake)

/** Ordem de inserção respeitando as foreign keys */
const INSERT_ORDER: TableName[] = [
  'members',
  'users',
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

export class SupabaseProvider implements DataProvider {
  readonly name = 'supabase' as const
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
    // Revalida as telas quando outro usuário altera dados (Supabase Realtime)
    const channel = this.client.channel('db-changes')
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => emitChange(table))
    }
    channel.subscribe()
  }

  private fail(action: string, error: { message: string } | null): never {
    throw new DataError(`Erro ao ${action}: ${error?.message ?? 'desconhecido'}`)
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    let query = this.client.from(table).select('*')
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = value === null ? query.is(toSnake(key), null) : query.eq(toSnake(key), value as string)
      }
    }
    const { data, error } = await query
    if (error) this.fail(`listar ${table}`, error)
    return (data ?? []).map((row) => fromDb<Row<T>>(row))
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).select('*').eq('id', id).maybeSingle()
    if (error) this.fail(`carregar ${table}`, error)
    return data ? fromDb<Row<T>>(data) : null
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).insert(toDb(row)).select().single()
    if (error) this.fail(`salvar ${table}`, error)
    emitChange(table)
    return fromDb<Row<T>>(data)
  }

  async insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<Row<T>[]> {
    if (rows.length === 0) return []
    const { data, error } = await this.client.from(table).insert(rows.map(toDb)).select()
    if (error) this.fail(`salvar ${table}`, error)
    emitChange(table)
    return (data ?? []).map((row) => fromDb<Row<T>>(row))
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).update(toDb(patch)).eq('id', id).select().single()
    if (error) this.fail(`atualizar ${table}`, error)
    emitChange(table)
    return fromDb<Row<T>>(data)
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq('id', id)
    if (error) this.fail(`excluir ${table}`, error)
    emitChange(table)
  }

  async removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void> {
    let query = this.client.from(table).delete()
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(toSnake(key), value as string)
    }
    const { error } = await query
    if (error) this.fail(`excluir ${table}`, error)
    emitChange(table)
  }

  /** Popula o Supabase com os dados de demonstração (tabelas precisam estar vazias) */
  async reset(): Promise<void> {
    const seed = createSeed()
    for (const table of [...INSERT_ORDER].reverse()) {
      const { error } = await this.client.from(table).delete().not('id', 'is', null)
      if (error) this.fail(`limpar ${table}`, error)
    }
    for (const table of INSERT_ORDER) {
      await this.insertMany(table, seed[table] as Row<typeof table>[])
    }
    emitChange(...TABLES)
  }

  async exportAll(): Promise<Partial<DatabaseState>> {
    const entries = await Promise.all(TABLES.map(async (table) => [table, await this.list(table)] as const))
    return Object.fromEntries(entries) as Partial<DatabaseState>
  }
}
