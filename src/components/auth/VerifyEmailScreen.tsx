import { useEffect, useState, type FormEvent } from 'react'
import { CircleCheck, CircleX, Hourglass, LogIn, Mail } from 'lucide-react'
import { authErrorMessage } from '@/contexts/auth'
import { ApiRequestError } from '@/services/apiClient'
import { authService } from '@/services/authService'
import type { UserStatus } from '@/types'
import { Button, Field, Input, LoadingState } from '@/components/ui'
import { AuthLayout } from './AuthLayout'
import { CheckEmailScreen } from './CheckEmailScreen'

type Result = { kind: 'ok'; status: UserStatus; email: string } | { kind: 'expired' } | { kind: 'invalid'; message: string }

/* O token é de uso único: guarda a confirmação em andamento (evita duas chamadas com o mesmo link) */
const attempts = new Map<string, Promise<Result>>()

function confirm(token: string): Promise<Result> {
  let attempt = attempts.get(token)
  if (!attempt) {
    attempt = authService.verifyEmail(token).then(
      (r): Result => ({ kind: 'ok', status: r.status, email: r.email }),
      (err: unknown): Result =>
        err instanceof ApiRequestError && err.code === 'TOKEN_EXPIRED' ? { kind: 'expired' } : { kind: 'invalid', message: authErrorMessage(err) },
    )
    attempts.set(token, attempt)
  }
  return attempt
}

/** Lê o token do link e o remove da barra de endereços (não fica no histórico) */
function takeToken(): string {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('token') ?? ''
  if (token) {
    url.searchParams.delete('token')
    window.history.replaceState(window.history.state, '', url.pathname + url.search)
    sessionStorage.setItem('verify-email-token', token)
  }
  return token || sessionStorage.getItem('verify-email-token') || ''
}

const goToLogin = () => {
  sessionStorage.removeItem('verify-email-token')
  window.location.replace('/')
}

/** Página aberta pelo botão "Confirmar meu e-mail" */
export function VerifyEmailScreen() {
  const [token] = useState(takeToken)
  const [result, setResult] = useState<Result | null>(() => (token ? null : { kind: 'invalid', message: 'Link de confirmação incompleto.' }))
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [resent, setResent] = useState<{ email: string; resendAfter: number } | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    void confirm(token).then((r) => active && setResult(r))
    return () => {
      active = false
    }
  }, [token])

  const resend = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setEmailError('Informe um e-mail válido.')
    setSending(true)
    setEmailError(null)
    try {
      const { resendAfter } = await authService.resendVerification(email)
      setResent({ email: email.trim().toLowerCase(), resendAfter })
    } catch (err) {
      setEmailError(authErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (resent) return <CheckEmailScreen email={resent.email} resendAfter={resent.resendAfter} onBack={goToLogin} />
  if (!result) {
    return (
      <AuthLayout title="Confirmando seu e-mail">
        <LoadingState label="Confirmando…" />
      </AuthLayout>
    )
  }

  if (result.kind === 'ok') {
    const approved = result.status === 'APPROVED'
    return (
      <AuthLayout title="E-mail confirmado" description={result.email}>
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          {approved ? (
            <CircleCheck className="mt-0.5 size-6 shrink-0 text-leaf-600 dark:text-leaf-300" aria-hidden />
          ) : (
            <Hourglass className="mt-0.5 size-6 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{approved ? 'Sua conta está liberada' : 'Aguardando aprovação do administrador'}</p>
            <p className="mt-1 text-sm text-ink-3">
              {approved
                ? 'Seu endereço foi confirmado. Você já pode entrar no sistema.'
                : 'Seu endereço foi confirmado. Você receberá um e-mail quando o administrador liberar o seu acesso.'}
            </p>
          </div>
        </div>
        <Button className="mt-6 w-full" leftIcon={<LogIn />} onClick={goToLogin}>
          {approved ? 'Entrar' : 'Ir para o login'}
        </Button>
      </AuthLayout>
    )
  }

  if (result.kind === 'expired') {
    return (
      <AuthLayout title="Link expirado" description="Os links de confirmação valem por 24 horas. Peça um novo e-mail:">
        <form onSubmit={resend} noValidate className="space-y-4">
          <Field label="E-mail do cadastro" htmlFor="expired-email" error={emailError}>
            <Input
              id="expired-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!emailError}
              leftIcon={<Mail />}
            />
          </Field>
          <Button type="submit" className="w-full" loading={sending}>
            Enviar novo link
          </Button>
          <Button variant="ghost" className="w-full" onClick={goToLogin}>
            Voltar para entrar
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Link inválido" description="Não foi possível confirmar o e-mail com este link.">
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
        <CircleX className="mt-0.5 size-6 shrink-0 text-red-600 dark:text-red-300" aria-hidden />
        <p className="min-w-0 text-sm text-ink-2">
          {result.message} Se você já confirmou o e-mail, basta entrar normalmente. Para receber outro link, tente entrar com seu e-mail e senha.
        </p>
      </div>
      <Button className="mt-6 w-full" leftIcon={<LogIn />} onClick={goToLogin}>
        Ir para o login
      </Button>
    </AuthLayout>
  )
}
