import { useState, type FormEvent } from 'react'
import { ArrowLeft, Lock, LogIn, Mail, MailCheck, User, UserPlus } from 'lucide-react'
import { authErrorMessage, useAuth } from '@/contexts/auth'
import { Button, Field, Input, SegmentedControl } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

type Mode = 'login' | 'signup' | 'forgot'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Entrar, criar conta e recuperar senha (Supabase Auth) */
export function AuthScreen() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [sentTo, setSentTo] = useState<{ email: string; kind: 'confirm' | 'reset' } | null>(null)
  const [loading, setLoading] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setFieldErrors({})
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (mode === 'signup' && name.trim().length < 2) errors.name = 'Informe seu nome.'
    if (!EMAIL.test(email.trim())) errors.email = 'Informe um e-mail válido.'
    if (mode !== 'forgot' && password.length < 6) errors.password = 'A senha precisa ter pelo menos 6 caracteres.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)
    try {
      if (mode === 'login') await signIn(email, password)
      else if (mode === 'signup') {
        const needsConfirmation = await signUp(name, email, password)
        if (needsConfirmation) setSentTo({ email: email.trim(), kind: 'confirm' })
      } else {
        await sendPasswordReset(email)
        setSentTo({ email: email.trim(), kind: 'reset' })
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title={sentTo.kind === 'confirm' ? 'Confirme seu e-mail' : 'Verifique seu e-mail'}
        description={
          sentTo.kind === 'confirm'
            ? 'Enviamos um link de confirmação. Depois de confirmar, volte aqui e entre com seu e-mail e senha.'
            : 'Enviamos um link para criar uma nova senha.'
        }
      >
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <MailCheck className="size-6 shrink-0 text-leaf-600 dark:text-leaf-300" aria-hidden />
          <p className="min-w-0 text-sm break-all text-ink">{sentTo.email}</p>
        </div>
        <p className="mt-3 text-xs text-ink-3">Não chegou? Confira a caixa de spam ou aguarde alguns minutos.</p>
        <Button
          variant="secondary"
          className="mt-6 w-full"
          leftIcon={<ArrowLeft />}
          onClick={() => {
            setSentTo(null)
            switchMode('login')
          }}
        >
          Voltar para entrar
        </Button>
      </AuthLayout>
    )
  }

  const titles: Record<Mode, { title: string; description: string }> = {
    login: { title: 'Entrar', description: 'Acesse os repertórios e escalas da equipe.' },
    signup: {
      title: 'Criar conta',
      description: 'A primeira conta criada é a do administrador. As próximas aguardam a aprovação dele.',
    },
    forgot: { title: 'Recuperar senha', description: 'Informe seu e-mail para receber o link de nova senha.' },
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
        {mode !== 'forgot' && (
          <Field
            label="Senha"
            htmlFor="auth-password"
            error={fieldErrors.password}
            hint={mode === 'signup' ? 'Mínimo de 6 caracteres.' : undefined}
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
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          leftIcon={mode === 'login' ? <LogIn /> : mode === 'signup' ? <UserPlus /> : <Mail />}
        >
          {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
        </Button>

        {mode === 'forgot' && (
          <Button variant="ghost" className="w-full" leftIcon={<ArrowLeft />} onClick={() => switchMode('login')}>
            Voltar para entrar
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
