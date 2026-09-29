import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearQueryCache } from '@/hooks/useQuery'
import { isSupabaseConfigured } from '@/services/config'
import { TABLES, emitChange } from '@/services/db'
import { getSupabase } from '@/services/supabaseClient'
import { AuthContext, type AuthContextValue, type AuthStatus, type AuthUser } from './auth'

const noop = async () => undefined

/** Modo demonstração: sem login, dados locais */
const DEMO: AuthContextValue = {
  mode: 'demo',
  status: 'signed_in',
  authUser: null,
  signIn: noop,
  signUp: async () => false,
  signOut: noop,
  sendPasswordReset: noop,
  updatePassword: noop,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <AuthContext.Provider value={DEMO}>{children}</AuthContext.Provider>
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const currentId = useRef<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    const apply = (user: { id: string; email?: string } | null, recovery = false) => {
      const next = user ? { id: user.id, email: user.email ?? '' } : null
      if (next?.id !== currentId.current) {
        currentId.current = next?.id ?? null
        // Outro usuário: descarta o cache e recarrega tudo com as permissões dele
        clearQueryCache()
        emitChange(...TABLES)
      }
      setAuthUser(next)
      setStatus(recovery ? 'recovery' : next ? 'signed_in' : 'signed_out')
    }

    void getSupabase()
      .then(async (supabase) => {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        apply(data.session?.user ?? null)
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          apply(session?.user ?? null, event === 'PASSWORD_RECOVERY')
        })
        unsubscribe = () => sub.subscription.unsubscribe()
      })
      .catch(() => !cancelled && setStatus('signed_out'))

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const supabase = await getSupabase()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
    })
    if (error) throw error
    return !data.session
  }, [])

  const signOut = useCallback(async () => {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const supabase = await getSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const supabase = await getSupabase()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setStatus((s) => (s === 'recovery' ? 'signed_in' : s))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ mode: 'supabase', status, authUser, signIn, signUp, signOut, sendPasswordReset, updatePassword }),
    [status, authUser, signIn, signUp, signOut, sendPasswordReset, updatePassword],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
