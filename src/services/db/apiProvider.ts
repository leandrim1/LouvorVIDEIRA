import type { DatabaseState } from '@/data/seed'
import { ApiRequestError, apiFetch, notifyUnauthorized, toApiError } from '../apiClient'
import { emitChange } from './changes'
import { DataError, TABLES, type DataProvider, type Filter, type Row, type TableName } from './types'

/** song_videos → song-videos (rota da API) */
const route = (table: TableName) => table.replace(/_/g, '-')

function query(filter?: object): string {
  if (!filter) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined) continue
    params.append(key, value === null ? 'null' : String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

const MAX_BATCH = 30
const MAX_ROWS_PER_REQUEST = 500
/** Intervalo mínimo entre revalidações ao voltar para a aba */
const REFRESH_INTERVAL = 30_000

type BatchResult = { status: number; data?: unknown; error?: { code?: string; message?: string } }
interface PendingRead {
  path: string
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
}

/**
 * Provedor que fala com a API (/api → Vercel Functions → Drizzle → Neon).
 * Leituras feitas no mesmo instante (ex.: dashboard) são agrupadas em uma única
 * chamada a /api/batch, reduzindo invocações das funções.
 */
export class ApiProvider implements DataProvider {
  readonly name = 'api' as const
  private queue: PendingRead[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastRefresh = Date.now()

  constructor() {
    if (typeof window === 'undefined') return
    // Sem conexão persistente com o banco: ao voltar para o app, busca o que outros alteraram
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - this.lastRefresh < REFRESH_INTERVAL) return
      this.lastRefresh = Date.now()
      emitChange(...TABLES)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
  }

  /* Leituras agrupadas ---------------------------------------------------- */

  private read<T>(path: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ path, resolve: resolve as (value: unknown) => void, reject })
      this.timer ??= setTimeout(() => void this.flush(), 8)
    })
  }

  private async flush() {
    const pending = this.queue
    this.queue = []
    this.timer = null
    for (let i = 0; i < pending.length; i += MAX_BATCH) {
      const chunk = pending.slice(i, i + MAX_BATCH)
      if (chunk.length === 1) {
        const [only] = chunk
        apiFetch(only.path).then(only.resolve, only.reject)
        continue
      }
      apiFetch<BatchResult[]>('batch', { method: 'POST', body: { requests: chunk.map((p) => ({ path: p.path })) } }).then(
        (results) => {
          let unauthorized = false
          chunk.forEach((p, index) => {
            const result = results[index]
            if (!result) return p.reject(new DataError('Resposta incompleta do servidor.'))
            if (result.status === 200) return p.resolve(result.data)
            if (result.status === 401) unauthorized = true
            // 401 é avisado uma única vez para o lote inteiro
            p.reject(result.status === 401 ? new ApiRequestError(401, 'UNAUTHORIZED', 'Faça login para continuar.') : toApiError(result.status, { error: result.error }))
          })
          if (unauthorized) notifyUnauthorized()
        },
        (error: unknown) => chunk.forEach((p) => p.reject(error)),
      )
    }
  }

  /* DataProvider ----------------------------------------------------------- */

  list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    return this.read<Row<T>[]>(`${route(table)}${query(filter)}`)
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    try {
      return await this.read<Row<T>>(`${route(table)}/${encodeURIComponent(id)}`)
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null
      throw error
    }
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const saved = await apiFetch<Row<T>>(route(table), { method: 'POST', body: row })
    emitChange(table)
    return saved
  }

  async insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<Row<T>[]> {
    if (rows.length === 0) return []
    const saved: Row<T>[] = []
    for (let i = 0; i < rows.length; i += MAX_ROWS_PER_REQUEST) {
      saved.push(...(await apiFetch<Row<T>[]>(route(table), { method: 'POST', body: rows.slice(i, i + MAX_ROWS_PER_REQUEST) })))
    }
    emitChange(table)
    return saved
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const saved = await apiFetch<Row<T>>(`${route(table)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
    emitChange(table)
    return saved
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    try {
      await apiFetch(`${route(table)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch (error) {
      // Já excluído (ex.: removido em cascata junto com o registro pai)
      if (!(error instanceof ApiRequestError && error.status === 404)) throw error
    }
    emitChange(table)
  }

  async removeWhere<T extends TableName>(table: T, filter: Filter<T>): Promise<void> {
    const qs = query(filter)
    if (!qs) throw new DataError('Informe ao menos um filtro para excluir em lote.')
    await apiFetch(`${route(table)}${qs}`, { method: 'DELETE' })
    emitChange(table)
  }

  reset(): Promise<void> {
    return Promise.reject(new DataError('Restaurar a demonstração não está disponível com o banco de dados real.'))
  }

  exportAll(): Promise<Partial<DatabaseState>> {
    return apiFetch<Partial<DatabaseState>>('export')
  }
}
