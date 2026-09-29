import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearQueryCache } from '@/hooks/useQuery'
import { apiFetch, onUnauthorized } from '@/services/apiClient'
import { isServerMode } from '@/services/config'
import { TABLES, emitChange } from '@/services/db'
import type { User } from '@/types'
import { AuthContext, type AuthContextValue, type AuthStatus, type AuthUser } from './auth'

const noop = async () => undefined

/** Modo demonstração: sem login, dados locais */
const DEMO: AuthContextValue = {
  mode: 'demo',
  status: 'signed_in',
  authUser: null,
  setupRequired: false,
  signIn: noop,
  signUp: noop,
  signOut: noop,
  changePassword: noop,
  fetchSessionUser: async () => null,
}

interface SessionResponse {
  user: User | null
  setupRequired: boolean
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isServerMode) return <AuthContext.Provider value={DEMO}>{children}</AuthContext.Provider>
  return <ServerAuthProvider>{children}</ServerAuthProvider>
}

/** Login real: sessão em cookie httpOnly emitido pela API (/api/auth/*) */
function ServerAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const currentId = useRef<string | null>(null)

  const apply = useCallback((user: User | null) => {
    const next = user ? { id: user.id, email: user.email } : null
    if (next?.id !== currentId.current) {
      currentId.current = next?.id ?? null
      // Outro usuário: descarta o cache e recarrega tudo com as permissões dele
      clearQueryCache()
      emitChange(...TABLES)
    }
    setAuthUser(next)
    setStatus(next ? 'signed_in' : 'signed_out')
  }, [])

  const fetchSessionUser = useCallback(async () => {
    const session = await apiFetch<SessionResponse>('auth/session')
    setSetupRequired(session.setupRequired)
    if (!session.user && currentId.current) apply(null)
    return session.user
  }, [apply])

  useEffect(() => {
    let cancelled = false
    apiFetch<SessionResponse>('auth/session')
      .then((session) => {
        if (cancelled) return
        setSetupRequired(session.setupRequired)
        apply(session.user)
      })
      .catch(() => !cancelled && setStatus('signed_out'))
    // Sessão expirada ou encerrada em outro aparelho
    const off = onUnauthorized(() => apply(null))
    return () => {
      cancelled = true
      off()
    }
  }, [apply])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { user } = await apiFetch<{ user: User }>('auth/login', { method: 'POST', body: { email: email.trim(), password } })
      apply(user)
    },
    [apply],
  )

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const { user } = await apiFetch<{ user: User }>('auth/signup', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password },
      })
      setSetupRequired(false)
      apply(user)
    },
    [apply],
  )

  const signOut = useCallback(async () => {
    try {
      await apiFetch('auth/logout', { method: 'POST', body: {} })
    } finally {
      apply(null)
    }
  }, [apply])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiFetch('auth/password', { method: 'POST', body: { currentPassword, newPassword } })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ mode: 'server', status, authUser, setupRequired, signIn, signUp, signOut, changePassword, fetchSessionUser }),
    [status, authUser, setupRequired, signIn, signUp, signOut, changePassword, fetchSessionUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
