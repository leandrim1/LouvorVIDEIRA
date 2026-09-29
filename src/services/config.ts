/**
 * Modo de dados (variável VITE_DATA_PROVIDER, definida no build):
 * - `api` (padrão): React → /api (Vercel Functions) → Drizzle → Neon PostgreSQL, com login real.
 * - `demo`: dados fictícios no navegador, sem login (usado no artifact de demonstração).
 * Nenhuma credencial do banco existe no frontend.
 */
export type DataMode = 'api' | 'demo'

export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_PROVIDER === 'demo' ? 'demo' : 'api'

/** Dados compartilhados no servidor, com login */
export const isServerMode = DATA_MODE === 'api'
