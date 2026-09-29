import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

let clientPromise: Promise<SupabaseClient> | null = null

/** Cliente único do Supabase (dados + autenticação), carregado sob demanda */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) return Promise.reject(new Error('Supabase não configurado.'))
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return clientPromise
}
