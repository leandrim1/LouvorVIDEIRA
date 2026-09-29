import { createContext, useContext } from 'react'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'recovery'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthContextValue {
  /** `demo`: dados locais sem login; `supabase`: login real */
  mode: 'demo' | 'supabase'
  status: AuthStatus
  authUser: AuthUser | null
  signIn: (email: string, password: string) => Promise<void>
  /** Retorna `true` quando é preciso confirmar o e-mail antes de entrar */
  signUp: (name: string, email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}

/** Traduz as mensagens de erro do Supabase Auth */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Entre ou recupere a senha.'
  if (m.includes('password should be') || m.includes('at least 6')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Informe um e-mail válido.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.'
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.'
  return message
}
