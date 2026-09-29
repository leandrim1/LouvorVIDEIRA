/**
 * Conexão com o PostgreSQL (Neon) — uso exclusivo no servidor.
 *
 * Usa o driver HTTP do Neon: cada consulta é uma requisição HTTPS sem estado,
 * sem conexões persistentes, ideal para Vercel Functions (serverless).
 */
import { neon } from '@neondatabase/serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

export { schema }
export type Schema = typeof schema

/** Instância do Drizzle independente do driver (Neon em produção; PGlite em dev/testes) */
export type Database = PgDatabase<PgQueryResultHKT, Schema>

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL não configurada.')
    this.name = 'DatabaseNotConfiguredError'
  }
}

let instance: Database | null = null

export function getDb(): Database {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) throw new DatabaseNotConfiguredError()
  instance = drizzle({ client: neon(url), schema })
  return instance
}

/** Permite ao servidor de desenvolvimento e aos testes usar outro driver (ex.: PGlite local) */
export function setDb(db: Database | null) {
  instance = db
}
