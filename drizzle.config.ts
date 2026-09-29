import { defineConfig } from 'drizzle-kit'

// Carrega as variáveis locais (ex.: criadas por `vercel env pull .env.local`)
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file)
  } catch {
    /* arquivo inexistente */
  }
}

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  // Com DATABASE_URL: Neon. Sem ela: o banco local de desenvolvimento em .pglite/
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : { driver: 'pglite', dbCredentials: { url: './.pglite' } }),
  strict: true,
  verbose: true,
})
