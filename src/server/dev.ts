/**
 * API no servidor de desenvolvimento do Vite (`npm run dev`).
 * - Com DATABASE_URL (ex.: `vercel env pull .env.local`): usa o Neon, igual à produção.
 * - Sem DATABASE_URL: usa um PostgreSQL local em .pglite/, com migrations e dados de exemplo.
 * Nunca é usado pelas Vercel Functions.
 */
import { setDb, type Database } from '../db/index.js'
import { handleRequest } from './router.js'

const store = globalThis as typeof globalThis & { __louvorLocalDb?: Promise<Database> }

async function openLocal(): Promise<Database> {
  const { openLocalDatabase } = await import('../db/local.js')
  const { isDatabaseEmpty, runSeed } = await import('../db/seed.js')
  const { db } = await openLocalDatabase()
  if (await isDatabaseEmpty(db)) {
    const email = process.env.SEED_ADMIN_EMAIL?.trim()
    const password = process.env.SEED_ADMIN_PASSWORD
    await runSeed(db, { admin: email && password && password.length >= 8 ? { email, password } : undefined })
    console.log('\n  [api] Banco local (.pglite) criado com dados de exemplo.\n')
  }
  return db
}

export async function devHandler(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    // Uma única instância por processo, mesmo quando o Vite recarrega este módulo
    store.__louvorLocalDb ??= openLocal()
    setDb(await store.__louvorLocalDb)
  }
  return handleRequest(request)
}
