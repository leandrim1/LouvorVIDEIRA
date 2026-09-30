import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Lock, Mail, MailCheck, RefreshCw } from 'lucide-react'
import { authErrorMessage } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { authService } from '@/services/authService'
import { Button, Field, Input } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Contagem regressiva para liberar o reenvio */
function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  return [seconds, setSeconds] as const
}

interface CheckEmailScreenProps {
  email: string
  /** Segundos até liberar o botão de reenvio */
  resendAfter: number
  /** Mensagem extra (ex.: "Já existe um cadastro aguardando confirmação") */
  notice?: string | null
  onBack: () => void
}

/** "Verifique seu e-mail": reenvio com intervalo mínimo e correção do endereço */
export function CheckEmailScreen({ email: initialEmail, resendAfter, notice, onBack }: CheckEmailScreenProps) {
  const toast = useToast()
  const [email, setEmail] = useState(initialEmail)
  const [seconds, setSeconds] = useCountdown(resendAfter)
  const [sending, setSending] = useState(false)
  const [changing, setChanging] = useState(false)
  const [password, setPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const resend = async () => {
    setSending(true)
    setError(null)
    try {
      const { resendAfter: wait } = await authService.resendVerification(email)
      setSeconds(wait)
      toast.success('E-mail reenviado', 'Confira a caixa de entrada e a pasta de spam.')
    } catch (err) {
      const retry = (err as { retryAfter?: number }).retryAfter
      if (retry) setSeconds(retry)
      setError(authErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!password) errors.password = 'Informe a senha da conta.'
    if (!EMAIL.test(newEmail.trim())) errors.newEmail = 'Informe um e-mail válido.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setSending(true)
    setError(null)
    try {
      const result = await authService.changePendingEmail(email, password, newEmail)
      setEmail(result.email)
      setSeconds(result.resendAfter)
      setChanging(false)
      setPassword('')
      setNewEmail('')
      toast.success('E-mail alterado', 'Enviamos um novo link de confirmação.')
    } catch (err) {
      const details = (err as { details?: Record<string, string[]> }).details
      if (details?.newEmail?.[0]) setFieldErrors({ newEmail: details.newEmail[0] })
      else setError(authErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthLayout title="Verifique seu e-mail" description="Enviamos um link de confirmação para:">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <MailCheck className="size-6 shrink-0 text-leaf-600 dark:text-leaf-300" aria-hidden />
        <p className="min-w-0 text-sm font-semibold break-all text-ink">{email}</p>
      </div>
      {notice && <p className="mt-3 text-sm text-ink-2">{notice}</p>}
      <p className="mt-3 text-sm text-ink-2">
        Abra o e-mail e clique em <strong className="font-semibold text-ink">Confirmar meu e-mail</strong>. Depois da confirmação, o administrador
        libera o seu acesso.
      </p>
      <p className="mt-2 text-xs text-ink-3">O link expira em 24 horas. Não chegou? Confira a pasta de spam.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-2">
        <Button variant="secondary" leftIcon={<RefreshCw />} onClick={() => void resend()} loading={sending && !changing} disabled={seconds > 0}>
          Reenviar e-mail
        </Button>
        <p className="text-center text-xs text-ink-3" aria-live="polite">
          {seconds > 0 ? `Você poderá solicitar novamente em ${seconds} segundos.` : ' '}
        </p>
      </div>

      {changing ? (
        <form onSubmit={changeEmail} noValidate className="mt-4 space-y-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Alterar e-mail</p>
          <Field label="Senha da conta" htmlFor="change-password" error={fieldErrors.password}>
            <Input
              id="change-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!fieldErrors.password}
              leftIcon={<Lock />}
            />
          </Field>
          <Field label="Novo e-mail" htmlFor="change-email" error={fieldErrors.newEmail}>
            <Input
              id="change-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              invalid={!!fieldErrors.newEmail}
              leftIcon={<Mail />}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={sending}>
              Enviar para o novo e-mail
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setChanging(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="mt-2 w-full text-center text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
        >
          E-mail errado? Alterar e-mail
        </button>
      )}

      <Button variant="ghost" className="mt-4 w-full" leftIcon={<ArrowLeft />} onClick={onBack}>
        Voltar para entrar
      </Button>
    </AuthLayout>
  )
}
