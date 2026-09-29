/** Carrega .env.local/.env nos scripts de linha de comando (a Vercel injeta as variáveis sozinha) */
export function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file)
    } catch {
      /* arquivo inexistente */
    }
  }
}
