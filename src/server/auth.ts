/**
 * Autenticação: senhas (scrypt), sessões e cookie httpOnly.
 * O token da sessão fica só no cookie do navegador; no banco guardamos apenas o hash SHA-256.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { members, sessions, users } from '../db/schema.js'
import { ApiError } from './http.js'

export type UserRow = typeof users.$inferSelect
export type MemberRow = typeof members.$inferSelect

export interface Session {
  sessionId: string
  user: UserRow
  member: MemberRow | null
}

export const SESSION_COOKIE = 'lv_session'
const SESSION_DAYS = 30

/* ------------------------------------------------------------------ */
/* Senhas                                                              */
/* ------------------------------------------------------------------ */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, keyB64] = stored.split('$')
  if (algorithm !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Hash descartável para equalizar o tempo de resposta quando o e-mail não existe */
let dummyHash: Promise<string> | null = null
export function dummyPasswordCheck(password: string) {
  dummyHash ??= hashPassword('senha-inexistente')
  return dummyHash.then((hash) => verifyPassword(password, hash))
}

/** Senha temporária legível (sem caracteres ambíguos) */
export function temporaryPassword(length = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/* ------------------------------------------------------------------ */
/* Sessões                                                             */
/* ------------------------------------------------------------------ */

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/* ------------------------------------------------------------------ */
/* Token de confirmação do e-mail                                      */
/* ------------------------------------------------------------------ */

export const VERIFICATION_HOURS = 24

/**
 * Token aleatório (256 bits) enviado no link. O banco guarda só o SHA-256 dele:
 * quem lê o banco não consegue montar um link válido.
 */
export function createVerificationToken() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    hash: sha256(token),
    expiresAt: new Date(Date.now() + VERIFICATION_HOURS * 3_600_000),
  }
}

export async function createSession(db: Database, userId: string, request: Request): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  })
  return token
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function getSession(db: Database, request: Request): Promise<Session | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token || token.length > 100) return null
  const [row] = await db
    .select({ sessionId: sessions.id, user: users, member: members })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(members, eq(members.id, users.memberId))
    // Só contas aprovadas e com e-mail confirmado têm sessão válida (suspensas saem na hora)
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, 'APPROVED'),
        eq(users.emailVerified, true),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function deleteSession(db: Database, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

/** Encerra todas as sessões da pessoa (suspensão, recusa, troca de e-mail ou de senha) */
export async function deleteUserSessions(db: Database, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

const isSecure = (request: Request) =>
  new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'

/** Cookie httpOnly (JavaScript da página não lê), SameSite=Lax e Secure em HTTPS */
export function buildCookie(name: string, value: string, maxAgeSeconds: number, request: Request): string {
  return [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`, isSecure(request) ? 'Secure' : '']
    .filter(Boolean)
    .join('; ')
}

export function sessionCookie(token: string, request: Request): string {
  return buildCookie(SESSION_COOKIE, token, SESSION_DAYS * 86_400, request)
}

export function clearSessionCookie(request: Request): string {
  return buildCookie(SESSION_COOKIE, '', 0, request)
}

/* ------------------------------------------------------------------ */
/* Exigências de acesso                                                */
/* ------------------------------------------------------------------ */

export function requireSession(session: Session | null): Session {
  if (!session) throw ApiError.unauthorized()
  return session
}

/** Usuário logado E liberado pelo administrador */
export function requireApproved(session: Session | null): Session {
  const s = requireSession(session)
  if (s.user.status !== 'APPROVED' || !s.user.emailVerified) throw ApiError.forbidden('Seu acesso ainda não foi liberado pelo administrador.')
  return s
}

/** Formato público do usuário: nunca expõe o hash da senha nem o do token de confirmação */
export function publicUser(user: UserRow) {
  const {
    passwordHash,
    emailVerificationTokenHash: _tokenHash,
    emailVerificationExpiresAt: _expiresAt,
    emailVerificationSentAt: _sentAt,
    ...rest
  } = user
  return {
    ...rest,
    registered: passwordHash !== null,
    approved: user.status === 'APPROVED' && user.emailVerified,
  }
}
