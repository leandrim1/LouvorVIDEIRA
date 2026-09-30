import { createSeed, type DatabaseState } from '@/data/seed'
import { sleep } from '@/lib/utils'
import { emitChange } from './changes'
import { DataError, TABLES, matchesFilter, type DataProvider, type Filter, type Row, type TableName } from './types'

const STORAGE_KEY = 'louvor-videira:db:v1'

/** Latência simulada para reproduzir o comportamento de uma API real */
const latency = () => sleep(60 + Math.random() * 120)

function load(): DatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DatabaseState>
      const seed = createSeed()
      // Garante que novas tabelas existam em bancos salvos por versões anteriores
      for (const table of TABLES) {
        if (!Array.isArray(parsed[table])) (parsed as Record<string, unknown>)[table] = seed[table]
      }
      // Migração: bancos locais antigos não tinham aprovação de usuários
      for (const user of parsed.users ?? []) {
        user.approved ??= true
        user.registered ??= true
        user.status ??= user.approved ? 'APPROVED' : 'PENDING_ADMIN_APPROVAL'
        user.emailVerified ??= true
      }
      return parsed as DatabaseState
    }
  } catch {
    /* storage indisponível ou corrompido: recomeça com a seed */
  }
  return createSeed()
}

export class LocalProvider implements DataProvider {
  readonly name = 'local' as const
  private state: DatabaseState
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.state = load()
    this.persist(true)
    if (typeof window !== 'undefined') {
      // Sincroniza alterações feitas em outras abas
      window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return
        try {
          this.state = JSON.parse(event.newValue) as DatabaseState
          emitChange(...TABLES)
        } catch {
          /* ignora */
        }
      })
    }
  }

  private persist(immediate = false) {
    const write = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
      } catch (error) {
        console.error('[LocalProvider] Falha ao salvar dados', error)
        throw new DataError('Não foi possível salvar os dados neste dispositivo (armazenamento cheio?).')
      }
    }
    if (immediate) {
      try {
        write()
      } catch {
        /* sem storage: segue em memória */
      }
      return
    }
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try {
        write()
      } catch {
        /* erro já registrado */
      }
    }, 50)
  }

  private rows<T extends TableName>(table: T): Row<T>[] {
    return this.state[table] as Row<T>[]
  }

  private setRows<T extends TableName>(table: T, rows: Row<T>[]) {
    ;(this.state as Record<TableName, unknown>)[table] = rows
    this.persist()
    emitChange(table)
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    await latency()
    return structuredClone(this.rows(table).filter((row) => matchesFilter(row, filter)))
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    await latency()
    const row = this.rows(table).find((r) => (r as { id: string }).id === id)
    return row ? structuredClone(row) : null
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    await latency()
    this.setRows(table, [...this.rows(table), structuredClone(row)])
    return structuredClone(row)
  }

  async insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<Row<T>[]> {
    if (rows.length === 0) return []
    await latency()
    this.setRows(table, [...this.rows(table), ...structuredClone(rows)])
    return structuredClone(rows)
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    await latency()
    let updated: Row<T> | null = null
    const next = this.rows(table).map((row) => {
      if ((row as { id: string }).id !== id) return row
      updated = { ...row, ...structuredClone(patch) }
      return updated
    })
    if (!updated) throw new DataError('Registro não encontrado para atualização.')
    this.setRows(table, next)
    return structuredClone(updated)
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    await latency()
    this.setRows(
      table,
      this.rows(table).filter((row) => (row as { id: string }).id !== id),
    )
  }

  async removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void> {
    await latency()
    this.setRows(
      table,
      this.rows(table).filter((row) => !matchesFilter(row, filter)),
    )
  }

  async reset(): Promise<void> {
    await latency()
    this.state = createSeed()
    this.persist(true)
    emitChange(...TABLES)
  }

  async exportAll(): Promise<DatabaseState> {
    return structuredClone(this.state)
  }
}
