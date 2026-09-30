/**
 * Utilitários dos testes da API: banco PostgreSQL em memória (PGlite, mesmas migrations do Neon),
 * chamadas HTTP ao roteador e captura dos e-mails (no lugar do Resend, apenas nos testes).
 */
import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { setDb, type Database } from '../../db/index'
import { openLocalDatabase } from '../../db/local'
import { users } from '../../db/schema'
import { setEmailTransport, type EmailMessage } from '../email'
import { setMxResolver } from '../emailValidation'
import { handleRequest } from '../router'

export const ORIGIN = 'http://louvor.test'

export interface CallOptions {
  body?: unknown
  cookie?: string
  origin?: string | null
  form?: FormData
  /** IP do cliente; por padrão um IP diferente a cada chamada (não esbarra nos limites) */
  ip?: string
  userAgent?: string
}

export const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
export const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'

export interface CallResult {
  status: number
  data: any
  error?: { code: string; message: string; details?: Record<string, string[]>; retryAfter?: number }
  setCookie: string
  /** Cookie de sessão (lv_session=…) */
  cookie: string
  /** Todos os cookies definidos na resposta, por nome */
  cookies: Record<string, string>
  /** Cabeçalhos Set-Cookie completos (com atributos) */
  setCookies: string[]
}

export async function call(method: string, path: string, options: CallOptions = {}): Promise<CallResult> {
  const headers = new Headers({
    host: 'louvor.test',
    'x-real-ip': options.ip ?? `10.${randomInt(255)}.${randomInt(255)}.${randomInt(255)}`,
    'user-agent': options.userAgent ?? CHROME_WINDOWS,
  })
  if (options.cookie) headers.set('cookie', options.cookie)
  if (method !== 'GET' && options.origin !== null) headers.set('origin', options.origin ?? ORIGIN)
  let body: FormData | string | undefined
  if (options.form) body = options.form
  else if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(options.body)
  }
  const response = await handleRequest(new Request(`${ORIGIN}/api/${path}`, { method, headers, body }))
  const text = await response.text()
  const json = text ? JSON.parse(text) : {}
  const all = response.headers.getSetCookie()
  const cookies: Record<string, string> = {}
  for (const c of all) {
    const [pair = ''] = c.split(';')
    const name = pair.slice(0, pair.indexOf('='))
    cookies[name] = pair.slice(pair.indexOf('=') + 1)
  }
  const session = all.find((c) => c.startsWith('lv_session='))
  return {
    status: response.status,
    data: json.data,
    error: json.error,
    setCookie: session ?? all[0] ?? '',
    cookie: session?.split(';')[0] ?? '',
    cookies,
    setCookies: all,
  }
}

/* E-mails enviados durante os testes */
export const outbox: (EmailMessage & { from: string })[] = []
export const lastEmailTo = (address: string) => [...outbox].reverse().find((m) => m.to === address.toLowerCase())
export const tokenFrom = (message: EmailMessage | undefined) => {
  const match = message?.text.match(/verify-email\?token=([A-Za-z0-9_-]+)/)
  if (!match) throw new Error('E-mail sem link de confirmação')
  return decodeURIComponent(match[1]!)
}

/** Domínios sem servidor de e-mail nos testes */
export const NO_MX_DOMAIN = 'dominio-sem-email.test'

export async function setupDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  process.env.EMAIL_FROM = 'Louvor Videira <nao-responda@louvor.test>'
  process.env.APP_URL = 'https://louvor.test'
  setEmailTransport(async (message) => {
    outbox.push(message)
  })
  setMxResolver(async (domain) => {
    if (domain === NO_MX_DOMAIN) throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
    return [{ exchange: `mx.${domain}`, priority: 10 }]
  })
  const local = await openLocalDatabase('memory://')
  setDb(local.db)
  return {
    db: local.db,
    close: async () => {
      setDb(null)
      setEmailTransport(null)
      setMxResolver(null)
      await local.close()
    },
  }
}

/** Cadastro + clique no link do e-mail */
export async function signupAndVerify(name: string, email: string, password: string) {
  const signup = await call('POST', 'auth/signup', { body: { name, email, password } })
  if (signup.status !== 201) throw new Error(`cadastro falhou: ${signup.status} ${signup.error?.message}`)
  const verify = await call('POST', 'auth/verify-email', { body: { token: tokenFrom(lastEmailTo(email)) } })
  if (verify.status !== 200) throw new Error(`confirmação falhou: ${verify.status} ${verify.error?.message}`)
  return verify.data as { status: string }
}

/** Código de acesso do último e-mail enviado para o endereço */
export const otpFrom = (message: EmailMessage | undefined) => {
  const match = message?.text.match(/Seu código de acesso é: (\d{6})/)
  if (!match) throw new Error('E-mail sem código de acesso')
  return match[1]!
}

/** Monta o cabeçalho Cookie a partir de pares nome=valor (valores vazios são ignorados) */
export const cookieHeader = (cookies: Record<string, string | undefined>) =>
  Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

export interface LoginOptions {
  trustDevice?: boolean
  deviceCookie?: string
  userAgent?: string
  ip?: string
}

/**
 * Login completo: etapa da senha e, se o dispositivo não for confiável, o código do e-mail.
 * Retorna a resposta final (ou a da etapa 1, se ela falhar ou entrar direto).
 */
export async function login(email: string, password: string, options: LoginOptions = {}): Promise<CallResult & { deviceCookie?: string }> {
  const device = options.deviceCookie
  const first = await call('POST', 'auth/login', {
    body: { email, password },
    cookie: cookieHeader({ lv_device: device }),
    userAgent: options.userAgent,
    ip: options.ip,
  })
  if (first.status !== 202) return { ...first, deviceCookie: first.cookies.lv_device ?? device }
  const code = otpFrom(lastEmailTo(email))
  const second = await call('POST', 'auth/login-verify', {
    body: { code, trustDevice: options.trustDevice ?? false },
    cookie: cookieHeader({ lv_login: first.cookies.lv_login, lv_device: first.cookies.lv_device === '' ? undefined : device }),
    userAgent: options.userAgent,
    ip: options.ip,
  })
  return { ...second, deviceCookie: second.cookies.lv_device ?? (first.cookies.lv_device === '' ? undefined : device) }
}

export async function userByEmail(db: Database, email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return row
}
