import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearQueryCache } from '@/hooks/useQuery'
import { apiFetch, onUnauthorized } from '@/services/apiClient'
import { authService, type SignInResult } from '@/services/authService'
import { pushService } from '@/services/pushService'
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
  signIn: async () => ({ otpRequired: false, trustedDevice: false }),
  verifyLoginCode: async () => ({ trustedDevice: false }),
  signOutEverywhere: noop,
  signUp: async (_name, email) => ({ email, resendAfter: 0 }),
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
    async (email: string, password: string): Promise<SignInResult> => {
      const result = await apiFetch<{ user?: User; trustedDevice?: boolean; otpRequired?: boolean; email?: string; resendAfter?: number }>(
        'auth/login',
        { method: 'POST', body: { email: email.trim(), password } },
      )
      if (result.otpRequired) return { otpRequired: true, email: result.email ?? '', resendAfter: result.resendAfter ?? 60 }
      apply(result.user ?? null)
      return { otpRequired: false, trustedDevice: Boolean(result.trustedDevice) }
    },
    [apply],
  )

  const verifyLoginCode = useCallback(
    async (code: string, trustDevice: boolean) => {
      const result = await apiFetch<{ user: User; trustedDevice: boolean }>('auth/login-verify', { method: 'POST', body: { code, trustDevice } })
      apply(result.user)
      return { trustedDevice: result.trustedDevice }
    },
    [apply],
  )

  const signOutEverywhere = useCallback(async () => {
    try {
      await pushService.detach()
      await apiFetch('auth/logout-all', { method: 'POST', body: {} })
    } finally {
      apply(null)
    }
  }, [apply])

  // O cadastro não abre sessão: primeiro a confirmação do e-mail, depois a aprovação
  const signUp = useCallback((name: string, email: string, password: string) => authService.signUp(name, email, password), [])

  const signOut = useCallback(async () => {
    try {
      // Este aparelho deixa de receber os avisos da conta que saiu
      await pushService.detach()
      await apiFetch('auth/logout', { method: 'POST', body: {} })
    } finally {
      apply(null)
    }
  }, [apply])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiFetch('auth/password', { method: 'POST', body: { currentPassword, newPassword } })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'server',
      status,
      authUser,
      setupRequired,
      signIn,
      verifyLoginCode,
      signUp,
      signOut,
      signOutEverywhere,
      changePassword,
      fetchSessionUser,
    }),
    [status, authUser, setupRequired, signIn, verifyLoginCode, signUp, signOut, signOutEverywhere, changePassword, fetchSessionUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
