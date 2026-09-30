/**
 * Login em duas etapas: senha + código enviado por e-mail, com dispositivo confiável opcional.
 *
 *  - A SESSÃO (cookie lv_session) continua sendo o único acesso ao sistema.
 *  - O DISPOSITIVO CONFIÁVEL (cookie lv_device) serve apenas para pular o código nos próximos logins.
 *  - O DESAFIO (cookie lv_login) liga o código a quem acertou a senha neste navegador.
 *
 * Tudo é verificado aqui, no servidor. Códigos e tokens são gerados com crypto (nunca Math.random)
 * e guardados apenas como hash.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { deviceTokens, otpCodes, securityEvents, type users } from '../db/schema.js'
import { buildCookie, readCookie, sha256 } from './auth.js'
import { loginCodeEmail, sendEmail } from './email.js'
import { ApiError } from './http.js'
import { clientIp, hit } from './rateLimit.js'

/* ------------------------------------------------------------------ */
/* Políticas (altere aqui para mudar prazos e limites)                */
/* ------------------------------------------------------------------ */

export const LOGIN_POLICY = {
  otpMinutes: 10,
  otpMaxAttempts: 5,
  otpResendSeconds: 60,
  /** Códigos enviados por pessoa numa janela de 15 minutos */
  otpPerUser: { max: 5, windowSeconds: 15 * 60 },
  /** Códigos enviados por IP numa hora */
  otpPerIp: { max: 20, windowSeconds: 60 * 60 },
  /** Tentativas de código por IP numa hora (somando todos os desafios) */
  otpVerifyPerIp: { max: 50, windowSeconds: 60 * 60 },
  /** O desafio vale um pouco mais que o código, para permitir reenvios */
  challengeMinutes: 30,
  trustedDeviceDays: 30,
} as const

export const CHALLENGE_COOKIE = 'lv_login'
export const DEVICE_COOKIE = 'lv_device'

type UserRow = typeof users.$inferSelect

/* ------------------------------------------------------------------ */
/* Eventos de segurança                                                */
/* ------------------------------------------------------------------ */

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'OTP_SENT'
  | 'OTP_FAILED'
  | 'OTP_LOCKED'
  | 'OTP_VERIFIED'
  | 'DEVICE_TRUSTED'
  | 'DEVICE_REJECTED'
  | 'DEVICE_REVOKED'
  | 'ALL_DEVICES_REVOKED'
  | 'LOGOUT'
  | 'LOGOUT_ALL'

/** Registra o evento; uma falha no registro nunca impede o login */
export async function logSecurityEvent(
  db: Database,
  request: Request,
  type: SecurityEventType,
  userId: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await db.insert(securityEvents).values({
      userId,
      type,
      ip: clientIp(request),
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
      metadata,
    })
  } catch (error) {
    console.error('[security] evento não registrado:', type, error instanceof Error ? error.message : error)
  }
}

/* ------------------------------------------------------------------ */
/* Identificação do dispositivo (a partir do User-Agent)              */
/* ------------------------------------------------------------------ */

export function describeDevice(userAgent: string): { browser: string; os: string; name: string } {
  const ua = userAgent || ''
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Navegador'
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Sistema desconhecido'
  return { browser, os, name: `${browser} — ${os}` }
}

/* ------------------------------------------------------------------ */
/* Código de acesso (OTP)                                              */
/* ------------------------------------------------------------------ */

/** 6 dígitos com gerador criptográfico (distribuição uniforme, 000000–999999) */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/** O código só vale junto com o desafio: vazamento do banco não revela códigos */
const otpHash = (challenge: string, code: string) => createHash('sha256').update(`${challenge}:${code}`).digest('hex')

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}

const challengeCookie = (value: string, request: Request) => buildCookie(CHALLENGE_COOKIE, value, LOGIN_POLICY.challengeMinutes * 60, request)
export const clearChallengeCookie = (request: Request) => buildCookie(CHALLENGE_COOKIE, '', 0, request)

/** Limites de envio de código (por pessoa e por IP) */
async function assertCanSendCode(db: Database, userId: string, request: Request) {
  const perIp = await hit(db, 'otp:ip', clientIp(request), LOGIN_POLICY.otpPerIp)
  const perUser = perIp === null ? await hit(db, 'otp:user', userId, LOGIN_POLICY.otpPerUser) : null
  const retryAfter = perIp ?? perUser
  if (retryAfter !== null) {
    throw ApiError.tooManyRequests(retryAfter, 'Muitos códigos solicitados. Aguarde alguns minutos antes de pedir outro.')
  }
}

async function deliverCode(user: Pick<UserRow, 'name' | 'email'>, code: string) {
  await sendEmail(loginCodeEmail(user.name, user.email, code, LOGIN_POLICY.otpMinutes))
}

/**
 * Cria o desafio de login e envia o código. Retorna o cookie do desafio.
 * Códigos anteriores ainda não usados da pessoa deixam de valer.
 */
export async function startOtpChallenge(db: Database, user: UserRow, request: Request): Promise<string> {
  await assertCanSendCode(db, user.id, request)
  const challenge = randomBytes(32).toString('base64url')
  const code = generateOtp()
  await db
    .update(otpCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(otpCodes.userId, user.id), isNull(otpCodes.usedAt)))
  const [row] = await db
    .insert(otpCodes)
    .values({
      userId: user.id,
      challengeHash: sha256(challenge),
      codeHash: otpHash(challenge, code),
      expiresAt: new Date(Date.now() + LOGIN_POLICY.otpMinutes * 60_000),
      requestedIp: clientIp(request),
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    })
    .returning({ id: otpCodes.id })
  try {
    await deliverCode(user, code)
  } catch (error) {
    await db.delete(otpCodes).where(eq(otpCodes.id, row!.id))
    throw error
  }
  await logSecurityEvent(db, request, 'OTP_SENT', user.id, { reason: 'new_device' })
  return challengeCookie(challenge, request)
}

async function currentChallenge(db: Database, request: Request) {
  const challenge = readCookie(request, CHALLENGE_COOKIE)
  if (!challenge || challenge.length > 100) {
    throw new ApiError(400, 'OTP_SESSION_EXPIRED', 'Sua tentativa de login expirou. Informe e-mail e senha novamente.')
  }
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.challengeHash, sha256(challenge))).limit(1)
  if (!row) throw new ApiError(400, 'OTP_SESSION_EXPIRED', 'Sua tentativa de login expirou. Informe e-mail e senha novamente.')
  return { challenge, row }
}

/** "Reenviar código": novo código no mesmo desafio, respeitando 60 s e os limites de envio */
export async function resendOtp(db: Database, request: Request, loadUser: (id: string) => Promise<UserRow | undefined>) {
  const { challenge, row } = await currentChallenge(db, request)
  if (row.usedAt && row.attempts < LOGIN_POLICY.otpMaxAttempts) {
    throw new ApiError(400, 'OTP_SESSION_EXPIRED', 'Sua tentativa de login expirou. Informe e-mail e senha novamente.')
  }
  const wait = Math.ceil((row.sentAt.getTime() + LOGIN_POLICY.otpResendSeconds * 1000 - Date.now()) / 1000)
  if (wait > 0) throw ApiError.tooManyRequests(wait, `Aguarde ${wait} segundos para pedir um novo código.`)
  if (row.createdAt.getTime() + LOGIN_POLICY.challengeMinutes * 60_000 < Date.now()) {
    throw new ApiError(400, 'OTP_SESSION_EXPIRED', 'Sua tentativa de login expirou. Informe e-mail e senha novamente.')
  }
  const user = await loadUser(row.userId)
  if (!user) throw new ApiError(400, 'OTP_SESSION_EXPIRED', 'Sua tentativa de login expirou. Informe e-mail e senha novamente.')
  await assertCanSendCode(db, user.id, request)

  const code = generateOtp()
  await db
    .update(otpCodes)
    .set({
      codeHash: otpHash(challenge, code),
      expiresAt: new Date(Date.now() + LOGIN_POLICY.otpMinutes * 60_000),
      attempts: 0,
      usedAt: null,
      sentAt: new Date(),
    })
    .where(eq(otpCodes.id, row.id))
  await deliverCode(user, code)
  await logSecurityEvent(db, request, 'OTP_SENT', user.id, { reason: 'resend' })
  return { email: maskEmail(user.email), resendAfter: LOGIN_POLICY.otpResendSeconds }
}

/**
 * Confere o código. Erros possíveis: incorreto (com tentativas restantes), expirado,
 * bloqueado após 5 erros ou já utilizado. Sucesso marca o código como usado (uso único).
 */
export async function verifyOtp(db: Database, request: Request, code: string): Promise<string> {
  const ipLimit = await hit(db, 'otp-verify:ip', clientIp(request), LOGIN_POLICY.otpVerifyPerIp)
  if (ipLimit !== null) throw ApiError.tooManyRequests(ipLimit)
  const { challenge, row } = await currentChallenge(db, request)

  if (row.attempts >= LOGIN_POLICY.otpMaxAttempts) {
    throw new ApiError(400, 'OTP_LOCKED', 'Limite de tentativas atingido. Solicite um novo código.')
  }
  if (row.usedAt) throw new ApiError(400, 'OTP_USED', 'Este código já foi utilizado. Solicite um novo código.')
  if (row.expiresAt < new Date()) throw new ApiError(400, 'OTP_EXPIRED', 'Este código expirou. Solicite um novo código.')

  if (!/^\d{6}$/.test(code) || !sameHash(otpHash(challenge, code), row.codeHash)) {
    const [updated] = await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, row.id))
      .returning({ attempts: otpCodes.attempts })
    const attempts = updated?.attempts ?? LOGIN_POLICY.otpMaxAttempts
    if (attempts >= LOGIN_POLICY.otpMaxAttempts) {
      await logSecurityEvent(db, request, 'OTP_LOCKED', row.userId, { attempts })
      throw new ApiError(400, 'OTP_LOCKED', 'Limite de tentativas atingido. Solicite um novo código.')
    }
    await logSecurityEvent(db, request, 'OTP_FAILED', row.userId, { attempts })
    const left = LOGIN_POLICY.otpMaxAttempts - attempts
    throw new ApiError(400, 'OTP_INVALID', `O código informado está incorreto. ${left === 1 ? 'Resta 1 tentativa.' : `Restam ${left} tentativas.`}`)
  }

  // Uso único: só uma requisição consegue marcar o código como usado
  const [used] = await db
    .update(otpCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, new Date())))
    .returning({ userId: otpCodes.userId })
  if (!used) throw new ApiError(400, 'OTP_USED', 'Este código já foi utilizado. Solicite um novo código.')
  await logSecurityEvent(db, request, 'OTP_VERIFIED', used.userId)
  return used.userId
}

export function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(1, Math.min(6, local.length - visible.length)))}@${domain}`
}

/* ------------------------------------------------------------------ */
/* Dispositivo confiável                                               */
/* ------------------------------------------------------------------ */

const deviceCookie = (token: string, request: Request) => buildCookie(DEVICE_COOKIE, token, LOGIN_POLICY.trustedDeviceDays * 86_400, request)
export const clearDeviceCookie = (request: Request) => buildCookie(DEVICE_COOKIE, '', 0, request)
const newDeviceToken = () => randomBytes(32).toString('base64url')
const deviceExpiry = () => new Date(Date.now() + LOGIN_POLICY.trustedDeviceDays * 86_400_000)

export type DeviceCheck =
  | { trusted: true; deviceId: string; cookie: string }
  | { trusted: false; reason: 'none' | 'invalid' | 'revoked' | 'expired' | 'other_user' | 'reused' | 'changed'; clearCookie: boolean }

/**
 * Este navegador é um dispositivo confiável DESTA pessoa?
 * Cada uso troca o token (o anterior deixa de valer); se um token antigo reaparecer,
 * o cookie pode ter sido copiado e o dispositivo é revogado.
 */
export async function checkTrustedDevice(db: Database, request: Request, userId: string): Promise<DeviceCheck> {
  const token = readCookie(request, DEVICE_COOKIE)
  if (!token) return { trusted: false, reason: 'none', clearCookie: false }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    await logSecurityEvent(db, request, 'DEVICE_REJECTED', userId, { reason: 'invalid' })
    return { trusted: false, reason: 'invalid', clearCookie: true }
  }
  const hash = sha256(token)
  const [device] = await db.select().from(deviceTokens).where(eq(deviceTokens.tokenHash, hash)).limit(1)

  if (!device) {
    const [reused] = await db.select().from(deviceTokens).where(eq(deviceTokens.previousTokenHash, hash)).limit(1)
    if (reused && !reused.revokedAt) {
      await db.update(deviceTokens).set({ revokedAt: new Date() }).where(eq(deviceTokens.id, reused.id))
      await logSecurityEvent(db, request, 'DEVICE_REVOKED', reused.userId, { deviceId: reused.id, reason: 'token_reused' })
      return { trusted: false, reason: 'reused', clearCookie: true }
    }
    await logSecurityEvent(db, request, 'DEVICE_REJECTED', userId, { reason: 'unknown_token' })
    return { trusted: false, reason: 'invalid', clearCookie: true }
  }

  const fail = async (reason: 'revoked' | 'expired' | 'other_user' | 'changed', clearCookie = true) => {
    await logSecurityEvent(db, request, 'DEVICE_REJECTED', userId, { reason, deviceId: device.id })
    return { trusted: false as const, reason, clearCookie }
  }
  if (device.userId !== userId) return fail('other_user', false)
  if (device.revokedAt) return fail('revoked')
  if (device.expiresAt < new Date()) return fail('expired')

  // Navegador ou sistema diferentes do registrado: não confia cegamente, pede o código
  const now = describeDevice(request.headers.get('user-agent') ?? '')
  if (now.browser !== device.browser || now.os !== device.os) return fail('changed')

  const ip = clientIp(request)
  const rotated = newDeviceToken()
  await db
    .update(deviceTokens)
    .set({
      tokenHash: sha256(rotated),
      previousTokenHash: hash,
      lastUsedAt: new Date(),
      lastIp: ip,
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    })
    .where(and(eq(deviceTokens.id, device.id), eq(deviceTokens.tokenHash, hash)))
  return { trusted: true, deviceId: device.id, cookie: deviceCookie(rotated, request) }
}

/** Marca este navegador como confiável por 30 dias; retorna o cookie */
export async function trustDevice(db: Database, request: Request, userId: string): Promise<string> {
  const token = newDeviceToken()
  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 300)
  const info = describeDevice(userAgent)
  // Um navegador = um registro: substitui a confiança anterior deste mesmo cookie, se houver
  const previous = readCookie(request, DEVICE_COOKIE)
  if (previous) {
    await db
      .update(deviceTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(deviceTokens.tokenHash, sha256(previous)), eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)))
  }
  const [device] = await db
    .insert(deviceTokens)
    .values({
      userId,
      tokenHash: sha256(token),
      deviceName: info.name,
      browser: info.browser,
      os: info.os,
      expiresAt: deviceExpiry(),
      lastIp: clientIp(request),
      userAgent,
    })
    .returning({ id: deviceTokens.id })
  await logSecurityEvent(db, request, 'DEVICE_TRUSTED', userId, { deviceId: device!.id, device: info.name })
  return deviceCookie(token, request)
}

/** Dispositivo confiável deste navegador (para "Revogar este dispositivo") */
export async function currentDeviceId(db: Database, request: Request, userId: string): Promise<string | null> {
  const token = readCookie(request, DEVICE_COOKIE)
  if (!token || token.length > 100) return null
  const [device] = await db
    .select({ id: deviceTokens.id })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.tokenHash, sha256(token)), eq(deviceTokens.userId, userId)))
    .limit(1)
  return device?.id ?? null
}

/** Lista para Configurações e para o administrador (nunca inclui hashes) */
export async function listDevices(db: Database, userId: string) {
  const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId)).orderBy(desc(deviceTokens.lastUsedAt))
  const now = Date.now()
  return rows.map((d) => ({
    id: d.id,
    deviceName: d.deviceName,
    browser: d.browser,
    os: d.os,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt,
    expiresAt: d.expiresAt,
    revokedAt: d.revokedAt,
    lastIp: d.lastIp,
    status: d.revokedAt ? ('revoked' as const) : d.expiresAt.getTime() < now ? ('expired' as const) : ('active' as const),
  }))
}

export async function revokeDevice(db: Database, deviceId: string, userId: string) {
  const [row] = await db
    .update(deviceTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(deviceTokens.id, deviceId), eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)))
    .returning({ id: deviceTokens.id })
  return Boolean(row)
}

/** Revoga todos numa única instrução (não há estado intermediário) */
export async function revokeAllDevices(db: Database, userId: string) {
  const rows = await db
    .update(deviceTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)))
    .returning({ id: deviceTokens.id })
  return rows.length
}
