import { useState, type FormEvent } from 'react'
import { KeyRound, LogOut, UserRound } from 'lucide-react'
import { authErrorMessage, useAuth } from '@/contexts/auth'
import { useSession } from '@/contexts/session'
import { useToast } from '@/contexts/toast'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { Avatar, Badge, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui'

/** Conta do usuário logado: dados, troca de senha e sair */
export function AccountCard({ id, className }: { id?: string; className?: string }) {
  const { authUser, updatePassword, signOut } = useAuth()
  const { user, member } = useSession()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    setError(null)
    setSaving(true)
    try {
      await updatePassword(password)
      setPassword('')
      toast.success('Senha alterada')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id={id} className={className}>
      <CardHeader title="Sua conta" icon={<UserRound />} />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name ?? authUser?.email ?? '?'} src={member?.photoUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">{user?.name}</p>
            <p className="truncate text-sm text-ink-3">{authUser?.email}</p>
            {user && (
              <Badge tone="brand" className="mt-1.5">
                {USER_ROLE_LABELS[user.role]}
              </Badge>
            )}
          </div>
        </div>
        <form onSubmit={submit} noValidate className="space-y-2">
          <Field label="Nova senha" htmlFor="account-password" error={error}>
            <Input
              id="account-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!error}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" size="sm" leftIcon={<KeyRound />} loading={saving}>
              Alterar senha
            </Button>
            <Button variant="danger-ghost" size="sm" leftIcon={<LogOut />} onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
