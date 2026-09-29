import { Hourglass, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useSession } from '@/contexts/session'
import { Button } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

/** Conta criada, aguardando o administrador liberar o acesso */
export function PendingScreen() {
  const { authUser, signOut } = useAuth()
  const { refresh, isLoading } = useSession()
  return (
    <AuthLayout
      title="Aguardando aprovação"
      description="Sua conta foi criada. Um administrador da equipe precisa liberar seu acesso em Administração."
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <Hourglass className="size-6 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Conta cadastrada</p>
          <p className="text-sm break-all text-ink-3">{authUser?.email}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-2">
        <Button leftIcon={<RefreshCw />} onClick={refresh} loading={isLoading}>
          Verificar novamente
        </Button>
        <Button variant="ghost" leftIcon={<LogOut />} onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
    </AuthLayout>
  )
}
