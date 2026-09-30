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
}

export interface CallResult {
  status: number
  data: any
  error?: { code: string; message: string; details?: Record<string, string[]>; retryAfter?: number }
  setCookie: string
  cookie: string
}

export async function call(method: string, path: string, options: CallOptions = {}): Promise<CallResult> {
  const headers = new Headers({ host: 'louvor.test', 'x-real-ip': options.ip ?? `10.${randomInt(255)}.${randomInt(255)}.${randomInt(255)}` })
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
  const setCookie = response.headers.get('set-cookie') ?? ''
  return { status: response.status, data: json.data, error: json.error, setCookie, cookie: setCookie.split(';')[0] ?? '' }
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

export async function login(email: string, password: string) {
  return call('POST', 'auth/login', { body: { email, password } })
}

export async function userByEmail(db: Database, email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return row
}
