/** Configuração do provedor de dados (variáveis de ambiente do Vite) */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const PROVIDER = (import.meta.env.VITE_DATA_PROVIDER as string | undefined) ?? 'local'

/** Supabase ativo: dados compartilhados e login real. Caso contrário, modo demonstração local. */
export const isSupabaseConfigured = PROVIDER === 'supabase' && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
