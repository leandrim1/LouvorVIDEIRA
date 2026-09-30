import { createContext, useContext } from 'react'
import type { PendingVerification } from '@/services/authService'
import type { User } from '@/types'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthContextValue {
  /** `demo`: dados locais sem login; `server`: login real na API */
  mode: 'demo' | 'server'
  status: AuthStatus
  authUser: AuthUser | null
  /** Nenhum administrador ativo ainda: a primeira conta criada vira administrador */
  setupRequired: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Cria a solicitação e envia o e-mail de confirmação (não entra no sistema) */
  signUp: (name: string, email: string, password: string) => Promise<PendingVerification>
  signOut: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Consulta a sessão no servidor (usuário, nível de acesso e aprovação) */
  fetchSessionUser: () => Promise<User | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}

/** Mensagem amigável para erros de login (as mensagens da API já vêm em português) */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const m = message.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.'
  return message
}
