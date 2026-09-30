import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/auth'
import { useSession } from '@/contexts/session'
import { LoadingState } from '@/components/ui'
import { AuthScreen } from './AuthScreen'
import { PendingScreen } from './PendingScreen'
import { VerifyEmailScreen } from './VerifyEmailScreen'

/** Com login real, só mostra o app para usuários autenticados e aprovados */
export function AuthGate({ children }: { children: ReactNode }) {
  const { mode, status } = useAuth()
  const { isLoading, pending } = useSession()
  if (mode === 'demo') return <>{children}</>
  // Link do e-mail de confirmação: funciona com ou sem sessão
  if (window.location.pathname === '/verify-email') return <VerifyEmailScreen />
  if (status === 'loading' || (status === 'signed_in' && isLoading)) {
    return <LoadingState label="Carregando…" className="min-h-dvh" />
  }
  if (status === 'signed_out') return <AuthScreen />
  if (pending) return <PendingScreen />
  return <>{children}</>
}
