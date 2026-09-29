/**
 * Banco PostgreSQL local para desenvolvimento sem Neon (PGlite: Postgres em WebAssembly).
 * Usado apenas por `npm run dev`, scripts e testes quando DATABASE_URL não está definida.
 * Nunca é importado pelas Vercel Functions.
 */
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema.js'
import type { Database } from './index.js'

export const LOCAL_DB_DIR = '.pglite'
export const MIGRATIONS_DIR = 'src/db/migrations'

/** Abre (ou cria) o banco local e aplica as migrations pendentes */
export async function openLocalDatabase(dataDir: string | undefined = LOCAL_DB_DIR): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite(dataDir)
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return { db, close: () => client.close() }
}
