import { createContext, useContext } from 'react'
import type { Permission } from '@/lib/permissions'
import type { Member, User } from '@/types'

export interface SessionContextValue {
  user: User | null
  member: Member | null
  isLoading: boolean
  can: (permission: Permission) => boolean
  /** Troca o usuário ativo (modo demonstração). Com Supabase Auth, vem da sessão. */
  switchUser: (userId: string) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>')
  return ctx
}

export function useCan(permission: Permission): boolean {
  return useSession().can(permission)
}
