import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { authErrorMessage, useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { Button, Field, Input } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

/** Aberta pelo link de recuperação de senha enviado por e-mail */
export function NewPasswordScreen() {
  const { updatePassword } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setError(null)
    setLoading(true)
    try {
      await updatePassword(password)
      toast.success('Senha alterada')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Nova senha" description="Escolha uma nova senha para sua conta.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Nova senha" htmlFor="np-password" hint="Mínimo de 6 caracteres.">
          <Input id="np-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirme a senha" htmlFor="np-confirm">
          <Input id="np-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading} leftIcon={<KeyRound />}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  )
}
