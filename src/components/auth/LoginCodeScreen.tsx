import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, KeyRound, LogIn, MailCheck, RefreshCw } from 'lucide-react'
import { authErrorMessage, useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { ApiRequestError } from '@/services/apiClient'
import { authService } from '@/services/authService'
import { Button, Checkbox, Field, Input } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

interface LoginCodeScreenProps {
  /** E-mail mascarado informado pelo servidor (ex.: jo••••@gmail.com) */
  email: string
  resendAfter: number
  onBack: () => void
}

/** Login, etapa 2: código de 6 dígitos enviado por e-mail + "Confiar neste dispositivo" */
export function LoginCodeScreen({ email: initialEmail, resendAfter, onBack }: LoginCodeScreenProps) {
  const { verifyLoginCode } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(false)
  const [seconds, setSeconds] = useState(resendAfter)
  const [error, setError] = useState<string | null>(null)
  /** Código vencido ou bloqueado: só resta pedir outro */
  const [needsNewCode, setNeedsNewCode] = useState(false)
  /** A tentativa de login expirou: volta para e-mail e senha */
  const [restart, setRestart] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError('Digite os 6 dígitos do código.')
    setVerifying(true)
    setError(null)
    try {
      const { trustedDevice } = await verifyLoginCode(code, trust)
      toast.success('Login realizado com sucesso.', trustedDevice ? 'Este dispositivo foi marcado como confiável.' : undefined)
    } catch (err) {
      const errorCode = err instanceof ApiRequestError ? err.code : ''
      setError(authErrorMessage(err))
      setCode('')
      if (errorCode === 'OTP_EXPIRED' || errorCode === 'OTP_LOCKED' || errorCode === 'OTP_USED') setNeedsNewCode(true)
      if (errorCode === 'OTP_SESSION_EXPIRED') setRestart(true)
      inputRef.current?.focus()
    } finally {
      setVerifying(false)
    }
  }

  const resend = async () => {
    setSending(true)
    setError(null)
    try {
      const result = await authService.resendLoginCode()
      setEmail(result.email)
      setSeconds(result.resendAfter)
      setNeedsNewCode(false)
      setCode('')
      toast.success('Enviamos um novo código', 'Confira a caixa de entrada e a pasta de spam.')
      inputRef.current?.focus()
    } catch (err) {
      const retry = err instanceof ApiRequestError ? err.retryAfter : undefined
      if (retry && retry <= 120) setSeconds(retry)
      if (err instanceof ApiRequestError && err.code === 'OTP_SESSION_EXPIRED') setRestart(true)
      setError(authErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthLayout title="Código de acesso" description="Enviamos um código de 6 dígitos para seu e-mail.">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <MailCheck className="size-6 shrink-0 text-leaf-600 dark:text-leaf-300" aria-hidden />
        <p className="min-w-0 text-sm font-semibold break-all text-ink">{email}</p>
      </div>
      <p className="mt-3 text-sm text-ink-2">Digite o código enviado para seu e-mail. Ele expira em 10 minutos.</p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <Field label="Código de 6 dígitos" htmlFor="login-code">
          <Input
            ref={inputRef}
            id="login-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            invalid={!!error}
            disabled={needsNewCode || restart}
            leftIcon={<KeyRound />}
            className="font-mono text-lg tracking-[0.4em]"
          />
        </Field>

        <Checkbox
          checked={trust}
          onChange={(e) => setTrust(e.target.checked)}
          label="Confiar neste dispositivo"
          description="Não solicitar código novamente neste dispositivo."
          disabled={needsNewCode || restart}
        />

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        {restart ? (
          <Button size="lg" className="w-full" leftIcon={<ArrowLeft />} onClick={onBack}>
            Entrar novamente
          </Button>
        ) : needsNewCode ? (
          <Button size="lg" className="w-full" leftIcon={<RefreshCw />} loading={sending} disabled={seconds > 0} onClick={() => void resend()}>
            {seconds > 0 ? `Enviar novo código em ${seconds}s` : 'Enviar novo código'}
          </Button>
        ) : (
          <Button type="submit" size="lg" className="w-full" loading={verifying} leftIcon={<LogIn />}>
            Entrar
          </Button>
        )}
      </form>

      {!restart && !needsNewCode && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          <span className="text-ink-3">Não recebeu o código?</span>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={seconds > 0 || sending}
            className="font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline dark:text-brand-300"
          >
            {seconds > 0 ? `Reenviar em ${seconds}s` : 'Reenviar código'}
          </button>
        </div>
      )}

      <Button variant="ghost" className="mt-4 w-full" leftIcon={<ArrowLeft />} onClick={onBack}>
        Voltar
      </Button>
    </AuthLayout>
  )
}
