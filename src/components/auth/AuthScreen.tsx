import { useState, type FormEvent } from 'react'
import { ArrowLeft, Hourglass, KeyRound, Lock, LogIn, Mail, MailWarning, User, UserPlus } from 'lucide-react'
import { authErrorMessage, useAuth } from '@/contexts/auth'
import { ApiRequestError } from '@/services/apiClient'
import { Button, Field, Input, SegmentedControl } from '@/components/ui'
import { AuthLayout } from './AuthLayout'
import { CheckEmailScreen } from './CheckEmailScreen'
import { LoginCodeScreen } from './LoginCodeScreen'

type Mode = 'login' | 'signup' | 'forgot'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Entrar, criar conta e recuperar senha (login real na API) */
export function AuthScreen() {
  const { signIn, signUp, setupRequired } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  /** Situação da conta informada no login (e-mail não confirmado, aguardando aprovação…) */
  const [status, setStatus] = useState<{ code: string; message: string } | null>(null)
  const [pending, setPending] = useState<{ email: string; resendAfter: number; notice?: string } | null>(null)
  /** Dispositivo não confiável: o servidor enviou um código de acesso por e-mail */
  const [codeStep, setCodeStep] = useState<{ email: string; resendAfter: number } | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setStatus(null)
    setFieldErrors({})
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (mode === 'signup' && name.trim().length < 2) errors.name = 'Informe seu nome.'
    if (!EMAIL.test(email.trim())) errors.email = 'Informe um e-mail válido.'
    if (mode === 'login' && !password) errors.password = 'Informe a senha.'
    if (mode === 'signup' && password.length < 8) errors.password = 'A senha precisa ter pelo menos 8 caracteres.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus(null)
    if (!validate()) return
    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await signIn(email, password)
        if (result.otpRequired) {
          setPassword('')
          setCodeStep({ email: result.email, resendAfter: result.resendAfter })
        }
      } else {
        const result = await signUp(name, email, password)
        setPending({ email: result.email, resendAfter: result.resendAfter })
      }
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : ''
      const details = err instanceof ApiRequestError ? err.details : undefined
      if (code === 'VERIFICATION_PENDING') {
        setPending({ email: email.trim().toLowerCase(), resendAfter: 0, notice: authErrorMessage(err) })
      } else if (['EMAIL_NOT_VERIFIED', 'PENDING_APPROVAL', 'ACCOUNT_REJECTED', 'ACCOUNT_SUSPENDED'].includes(code)) {
        setStatus({ code, message: authErrorMessage(err) })
      } else if (details && Object.keys(details).some((k) => ['name', 'email', 'password'].includes(k))) {
        setFieldErrors(Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v[0] ?? ''])))
      } else {
        setError(authErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  if (codeStep) {
    return (
      <LoginCodeScreen
        email={codeStep.email}
        resendAfter={codeStep.resendAfter}
        onBack={() => {
          setCodeStep(null)
          switchMode('login')
        }}
      />
    )
  }

  if (pending) {
    return (
      <CheckEmailScreen
        email={pending.email}
        resendAfter={pending.resendAfter}
        notice={pending.notice}
        onBack={() => {
          setPending(null)
          switchMode('login')
        }}
      />
    )
  }

  const titles: Record<Mode, { title: string; description: string }> = {
    login: { title: 'Entrar', description: 'Acesse os repertórios e escalas da equipe.' },
    signup: {
      title: 'Criar conta',
      description: setupRequired
        ? 'A primeira conta criada é a do administrador, com acesso total, após a confirmação do e-mail.'
        : 'Depois de criar a conta, confirme seu e-mail e aguarde a liberação do administrador.',
    },
    forgot: { title: 'Recuperar senha', description: 'A senha é redefinida pelo administrador da equipe.' },
  }

  return (
    <AuthLayout title={titles[mode].title} description={titles[mode].description}>
      {mode !== 'forgot' && (
        <SegmentedControl<Mode>
          label="Acesso"
          value={mode}
          onChange={switchMode}
          fullWidth
          className="mb-6"
          options={[
            { value: 'login', label: 'Entrar' },
            { value: 'signup', label: 'Criar conta' },
          ]}
        />
      )}

      {mode === 'forgot' ? (
        <>
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <KeyRound className="mt-0.5 size-6 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
            <p className="min-w-0 text-sm text-ink-2">
              Peça ao administrador da equipe para gerar uma <strong className="font-semibold text-ink">senha temporária</strong> em
              Administração → Usuários. Depois de entrar, troque a senha em Configurações.
            </p>
          </div>
          <Button variant="secondary" className="mt-6 w-full" leftIcon={<ArrowLeft />} onClick={() => switchMode('login')}>
            Voltar para entrar
          </Button>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {mode === 'signup' && (
            <Field label="Nome" htmlFor="auth-name" error={fieldErrors.name}>
              <Input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!fieldErrors.name} leftIcon={<User />} />
            </Field>
          )}
          <Field label="E-mail" htmlFor="auth-email" error={fieldErrors.email}>
            <Input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!fieldErrors.email}
              leftIcon={<Mail />}
            />
          </Field>
          <Field
            label="Senha"
            htmlFor="auth-password"
            error={fieldErrors.password}
            hint={mode === 'signup' ? 'Mínimo de 8 caracteres.' : undefined}
            labelAction={
              mode === 'login' ? (
                <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                  Esqueci minha senha
                </button>
              ) : undefined
            }
          >
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!fieldErrors.password}
              leftIcon={<Lock />}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          {status && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              {status.code === 'EMAIL_NOT_VERIFIED' ? (
                <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
              ) : (
                <Hourglass className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
              )}
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-ink">{status.message}</p>
                {status.code === 'EMAIL_NOT_VERIFIED' && (
                  <button
                    type="button"
                    onClick={() => setPending({ email: email.trim().toLowerCase(), resendAfter: 0 })}
                    className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
                  >
                    Reenviar e-mail de confirmação
                  </button>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={loading}
            leftIcon={mode === 'login' ? <LogIn /> : <UserPlus />}
          >
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
