import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_USER_ID } from '@/data/seed'
import { readStorage, writeStorage } from '@/hooks/useLocalStorage'
import { useQuery } from '@/hooks/useQuery'
import { hasPermission, type Permission } from '@/lib/permissions'
import { db } from '@/services'
import { useAuth } from './auth'
import { SessionContext } from './session'

const SESSION_KEY = 'session:userId'

/**
 * Sessão da aplicação.
 * - Login real (Supabase): o usuário é o cadastro vinculado à conta autenticada.
 * - Demonstração: o perfil ativo é escolhido em Configurações para testar os níveis de acesso.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { mode, authUser } = useAuth()
  const [demoUserId, setDemoUserId] = useState<string>(() => readStorage(SESSION_KEY, DEFAULT_USER_ID))

  const key = mode === 'supabase' ? (authUser ? `session:auth:${authUser.id}` : null) : `session:${demoUserId}`
  const { data, isLoading, refetch } = useQuery(
    key,
    async () => {
      if (mode === 'supabase') {
        const [user] = await db.list('users', { authUserId: authUser!.id })
        const member = user?.approved && user.memberId ? await db.get('members', user.memberId) : null
        return { user: user ?? null, member }
      }
      const users = await db.list('users')
      const user = users.find((u) => u.id === demoUserId) ?? users.find((u) => u.role === 'admin') ?? users[0] ?? null
      const member = user?.memberId ? await db.get('members', user.memberId) : null
      return { user, member }
    },
    ['users', 'members'],
  )

  const switchUser = useCallback((id: string) => {
    writeStorage(SESSION_KEY, id)
    setDemoUserId(id)
  }, [])

  const user = data?.user ?? null
  const approved = Boolean(user?.approved)
  const pending = mode === 'supabase' && Boolean(authUser) && !isLoading && !approved
  const can = useCallback((permission: Permission) => approved && hasPermission(user?.role, permission), [approved, user?.role])

  const value = useMemo(
    () => ({ user, member: data?.member ?? null, isLoading, pending, can, switchUser, refresh: refetch }),
    [user, data?.member, isLoading, pending, can, switchUser, refetch],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
