import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_USER_ID } from '@/data/seed'
import { readStorage, writeStorage } from '@/hooks/useLocalStorage'
import { useQuery } from '@/hooks/useQuery'
import { hasPermission, type Permission } from '@/lib/permissions'
import { db } from '@/services'
import { SessionContext } from './session'

const SESSION_KEY = 'session:userId'

/**
 * Sessão da aplicação. No modo local, o usuário ativo é escolhido nas
 * Configurações (para demonstrar os níveis de acesso). Ao integrar o
 * Supabase Auth, basta resolver `userId` a partir de `supabase.auth.getUser()`.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>(() => readStorage(SESSION_KEY, DEFAULT_USER_ID))

  const { data, isLoading } = useQuery(
    `session:${userId}`,
    async () => {
      const users = await db.list('users')
      const user = users.find((u) => u.id === userId) ?? users.find((u) => u.role === 'admin') ?? users[0] ?? null
      const member = user?.memberId ? await db.get('members', user.memberId) : null
      return { user, member }
    },
    ['users', 'members'],
  )

  const switchUser = useCallback((id: string) => {
    writeStorage(SESSION_KEY, id)
    setUserId(id)
  }, [])

  const user = data?.user ?? null
  const can = useCallback((permission: Permission) => hasPermission(user?.role, permission), [user?.role])

  const value = useMemo(
    () => ({ user, member: data?.member ?? null, isLoading, can, switchUser }),
    [user, data?.member, isLoading, can, switchUser],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
