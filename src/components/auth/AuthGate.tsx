import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/auth'
import { useSession } from '@/contexts/session'
import { LoadingState } from '@/components/ui'
import { AuthScreen } from './AuthScreen'
import { NewPasswordScreen } from './NewPasswordScreen'
import { PendingScreen } from './PendingScreen'

/** Com login real, só mostra o app para usuários autenticados e aprovados */
export function AuthGate({ children }: { children: ReactNode }) {
  const { mode, status } = useAuth()
  const { isLoading, pending } = useSession()
  if (mode === 'demo') return <>{children}</>
  if (status === 'loading' || (status === 'signed_in' && isLoading)) {
    return <LoadingState label="Carregando…" className="min-h-dvh" />
  }
  if (status === 'recovery') return <NewPasswordScreen />
  if (status === 'signed_out') return <AuthScreen />
  if (pending) return <PendingScreen />
  return <>{children}</>
}
