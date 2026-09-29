/**
 * Aplica as migrations versionadas de src/db/migrations.
 *   npm run db:migrate
 * Com DATABASE_URL → Neon. Sem DATABASE_URL → banco PostgreSQL local (.pglite) de desenvolvimento.
 * Migrations já aplicadas são ignoradas (controle na tabela drizzle.__drizzle_migrations).
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { loadLocalEnv } from './env.js'
import { LOCAL_DB_DIR, MIGRATIONS_DIR, openLocalDatabase } from './local.js'

loadLocalEnv()

async function main() {
  const url = process.env.DATABASE_URL
  if (url) {
    const db = drizzle({ client: neon(url) })
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    console.log('✓ Migrations aplicadas no banco configurado em DATABASE_URL.')
    return
  }
  const { close } = await openLocalDatabase()
  await close()
  console.log(`✓ DATABASE_URL não definida: migrations aplicadas no banco local (${LOCAL_DB_DIR}/).`)
}

main().catch((error: unknown) => {
  console.error('✗ Falha ao aplicar migrations:', error instanceof Error ? error.message : error)
  process.exit(1)
})
