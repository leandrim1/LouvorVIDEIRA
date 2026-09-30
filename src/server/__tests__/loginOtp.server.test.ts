/**
 * Login em duas etapas (senha + código por e-mail) e dispositivos confiáveis.
 * PostgreSQL real em memória; e-mails capturados em vez de enviados ao Resend.
 */
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../db/index'
import { deviceTokens, otpCodes, rateLimits, securityEvents, sessions } from '../../db/schema'
import { generateOtp } from '../loginSecurity'
import {
  CHROME_ANDROID,
  call,
  cookieHeader,
  lastEmailTo,
  login,
  otpFrom,
  outbox,
  setupDatabase,
  signupAndVerify,
  userByEmail,
} from './helpers'

let db: Database
let close: () => Promise<void>
let adminCookie = ''
const EMAIL = 'ana.otp@gmail.com'
const PASSWORD = 'senha-da-ana-123'
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

/** Etapa 1 (senha) sem cookie de dispositivo */
const start = (opts: { device?: string; ua?: string; ip?: string } = {}) =>
  call('POST', 'auth/login', { body: { email: EMAIL, password: PASSWORD }, cookie: cookieHeader({ lv_device: opts.device }), userAgent: opts.ua, ip: opts.ip })
const verify = (challenge: string, code: string, trustDevice = false, extra: { device?: string; ip?: string } = {}) =>
  call('POST', 'auth/login-verify', { body: { code, trustDevice }, cookie: cookieHeader({ lv_login: challenge, lv_device: extra.device }), ip: extra.ip })
const wrongCode = (code: string) => (code === '000000' ? '000001' : '000000')
const events = async (type: string) => (await db.select().from(securityEvents).where(eq(securityEvents.type, type))).length

beforeAll(async () => {
  ;({ db, close } = await setupDatabase())
  await signupAndVerify('Admin', 'admin.otp@gmail.com', 'senha-admin-123')
  adminCookie = (await login('admin.otp@gmail.com', 'senha-admin-123')).cookie
  await signupAndVerify('Ana Souza', EMAIL, PASSWORD)
  const id = (await userByEmail(db, EMAIL))!.id
  await call('POST', `users/${id}/approve`, { cookie: adminCookie, body: {} })
}, 60_000)

afterAll(async () => {
  await close()
})

describe('código por e-mail', () => {
  let challenge = ''
  let code = ''

  it('1/2. dispositivo novo: senha correta não abre sessão e envia o código', async () => {
    const res = await start()
    expect(res.status).toBe(202)
    expect(res.data).toMatchObject({ otpRequired: true, resendAfter: 60, expiresInMinutes: 10 })
    expect(res.data.email).toMatch(/^an•+@gmail\.com$/)
    expect(res.cookies.lv_session).toBeUndefined()
    challenge = res.cookies.lv_login!
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const mail = lastEmailTo(EMAIL)!
    expect(mail.subject).toBe('Seu código de acesso — Louvor Videira')
    expect(mail.text).toContain('Olá, Ana Souza.')
    expect(mail.text).toContain('Esse código expira em 10 minutos.')
    expect(mail.text).toContain('Se você não tentou entrar no Louvor Videira, ignore este e-mail.')
    expect(mail.text).not.toContain(PASSWORD)
    code = otpFrom(mail)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('o banco guarda só o hash do código (ligado ao desafio), nunca o código', async () => {
    const [row] = await db.select().from(otpCodes).where(eq(otpCodes.challengeHash, sha256(challenge)))
    expect(row!.codeHash).not.toContain(code)
    expect(row!.codeHash).not.toBe(sha256(code))
    expect(row!.codeHash).toBe(sha256(`${challenge}:${code}`))
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000)
  })

  it('senha errada não envia código nem revela se o e-mail existe', async () => {
    const before = outbox.length
    const wrong = await call('POST', 'auth/login', { body: { email: EMAIL, password: 'errada' } })
    const unknown = await call('POST', 'auth/login', { body: { email: 'ninguem@gmail.com', password: 'errada' } })
    expect(wrong.status).toBe(401)
    expect(unknown.error?.message).toBe(wrong.error?.message)
    expect(outbox.length).toBe(before)
  })

  it('4. código incorreto informa as tentativas restantes', async () => {
    const res = await verify(challenge, wrongCode(code))
    expect(res.status).toBe(400)
    expect(res.error?.code).toBe('OTP_INVALID')
    expect(res.error?.message).toMatch(/^O código informado está incorreto\. Restam 4 tentativas\./)
    expect(res.cookies.lv_session).toBeUndefined()
  })

  it('código sem o cookie do desafio (outro navegador) não funciona', async () => {
    const res = await call('POST', 'auth/login-verify', { body: { code } })
    expect(res.status).toBe(400)
    expect(res.error?.code).toBe('OTP_SESSION_EXPIRED')
  })

  it('3. código correto abre a sessão (sem confiar no dispositivo)', async () => {
    const res = await verify(challenge, code)
    expect(res.status).toBe(200)
    expect(res.data.trustedDevice).toBe(false)
    expect(res.cookies.lv_session).toBeTruthy()
    expect(res.cookies.lv_device).toBeUndefined()
    expect(res.cookies.lv_login).toBe('')
    expect((await call('GET', 'songs', { cookie: res.cookie })).status).toBe(200)
  })

  it('6. o mesmo código não pode ser reutilizado', async () => {
    const res = await verify(challenge, code)
    expect(res.status).toBe(400)
    expect(res.error?.code).toBe('OTP_USED')
  })

  it('5. código expirado', async () => {
    const res = await start()
    const c = res.cookies.lv_login!
    await db.update(otpCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(otpCodes.challengeHash, sha256(c)))
    const expired = await verify(c, otpFrom(lastEmailTo(EMAIL)))
    expect(expired.error).toMatchObject({ code: 'OTP_EXPIRED', message: 'Este código expirou. Solicite um novo código.' })
  })

  it('7. após 5 códigos incorretos o código é bloqueado, mesmo digitando o certo', async () => {
    const res = await start()
    const c = res.cookies.lv_login!
    const right = otpFrom(lastEmailTo(EMAIL))
    for (let i = 1; i <= 4; i++) expect((await verify(c, wrongCode(right))).error?.code).toBe('OTP_INVALID')
    const fifth = await verify(c, wrongCode(right))
    expect(fifth.error).toMatchObject({ code: 'OTP_LOCKED', message: 'Limite de tentativas atingido. Solicite um novo código.' })
    expect((await verify(c, right)).error?.code).toBe('OTP_LOCKED')
    expect(await events('OTP_LOCKED')).toBeGreaterThan(0)
  })

  it('8. reenvio: novo código (o anterior deixa de valer), só depois de 60 s', async () => {
    const res = await start()
    const c = res.cookies.lv_login!
    const old = otpFrom(lastEmailTo(EMAIL))
    const early = await call('POST', 'auth/login-resend', { cookie: cookieHeader({ lv_login: c }) })
    expect(early.status).toBe(429)
    expect(early.error?.retryAfter).toBeGreaterThan(50)

    await db.update(otpCodes).set({ sentAt: new Date(Date.now() - 61_000) }).where(eq(otpCodes.challengeHash, sha256(c)))
    const resent = await call('POST', 'auth/login-resend', { cookie: cookieHeader({ lv_login: c }) })
    expect(resent.status).toBe(200)
    expect(resent.data.resendAfter).toBe(60)
    const fresh = otpFrom(lastEmailTo(EMAIL))
    if (fresh !== old) expect((await verify(c, old)).error?.code).toBe('OTP_INVALID')
    expect((await verify(c, fresh)).status).toBe(200)
  })

  it('9. rate limiting: códigos por pessoa e tentativas por IP', async () => {
    // Já foram enviados vários códigos para a Ana; um novo pedido estoura o limite de 5 por 15 minutos
    let status = 0
    for (let i = 0; i < 3; i++) status = (await start()).status
    expect(status).toBe(429)
    // Muitas tentativas de código a partir do mesmo IP
    let last = 0
    for (let i = 0; i < 51; i++) last = (await verify('x'.repeat(43), '123456', false, { ip: '198.51.100.9' })).status
    expect(last).toBe(429)
  })

  it('códigos usam gerador criptográfico e cobrem todos os dígitos', () => {
    const codes = Array.from({ length: 2000 }, generateOtp)
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true)
    expect(new Set(codes).size).toBeGreaterThan(1990)
  })
})

describe('dispositivo confiável', () => {
  const USER = 'bruno.device@gmail.com'
  const PASS = 'senha-do-bruno-123'
  let device = ''

  // Aqui o foco são os dispositivos: zera os limites de envio entre os testes
  beforeEach(async () => {
    await db.delete(rateLimits)
  })

  beforeAll(async () => {
    await db.delete(rateLimits)
    await signupAndVerify('Bruno Lima', USER, PASS)
    await call('POST', `users/${(await userByEmail(db, USER))!.id}/approve`, { cookie: adminCookie, body: {} })
  })

  it('10. "Confiar neste dispositivo" cria o token em cookie httpOnly (hash no banco)', async () => {
    const res = await login(USER, PASS, { trustDevice: true })
    expect(res.status).toBe(200)
    expect(res.data.trustedDevice).toBe(true)
    device = res.deviceCookie!
    expect(device).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const again = await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${device}` })
    const raw = again.setCookies.find((c) => c.startsWith('lv_device='))!
    expect(raw).toMatch(/HttpOnly/)
    expect(raw).toMatch(/SameSite=Lax/)
    expect(raw).toMatch(/Max-Age=2592000/)
    device = again.cookies.lv_device!
    const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.userId, (await userByEmail(db, USER))!.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.tokenHash).toBe(sha256(device))
    expect(rows[0]!.deviceName).toBe('Chrome — Windows')
    expect(rows[0]!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000)
  })

  it('11. próximo login no mesmo dispositivo entra direto, sem código; o token é trocado a cada uso', async () => {
    const before = outbox.length
    const res = await login(USER, PASS, { deviceCookie: device })
    expect(res.status).toBe(200)
    expect(res.data.trustedDevice).toBe(true)
    expect(outbox.length).toBe(before)
    expect(res.deviceCookie).not.toBe(device)
    device = res.deviceCookie!
  })

  it('22. reutilizar um token antigo (cookie copiado) revoga o dispositivo e exige código', async () => {
    const stolen = device
    const legit = await login(USER, PASS, { deviceCookie: stolen })
    expect(legit.data.trustedDevice).toBe(true)
    const attacker = await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${stolen}` })
    expect(attacker.status).toBe(202)
    expect(attacker.cookies.lv_device).toBe('')
    // O dispositivo legítimo também perdeu a confiança (precisa de código de novo)
    const again = await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${legit.deviceCookie}` })
    expect(again.status).toBe(202)
    device = (await login(USER, PASS, { trustDevice: true })).deviceCookie!
  })

  it('12. outro dispositivo (outro navegador/celular ou sem cookie) exige código', async () => {
    expect((await call('POST', 'auth/login', { body: { email: USER, password: PASS } })).status).toBe(202)
    // Mesmo token apresentado por outro navegador/sistema: não confia cegamente
    const other = await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${device}`, userAgent: CHROME_ANDROID })
    expect(other.status).toBe(202)
    expect(await events('DEVICE_REJECTED')).toBeGreaterThan(0)
    const phone = await login(USER, PASS, { trustDevice: true, userAgent: CHROME_ANDROID })
    expect(phone.status).toBe(200)
    const list = (await call('GET', 'auth/devices', { cookie: phone.cookie })).data as { deviceName: string; status: string }[]
    expect(list.some((d) => d.deviceName === 'Chrome — Android' && d.status === 'active')).toBe(true)
  })

  it('20/21. token inválido, adulterado ou de outra pessoa não é aceito', async () => {
    for (const bad of ['abc', 'x'.repeat(43), `${device.slice(0, -1)}${device.endsWith('A') ? 'B' : 'A'}`]) {
      const res = await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${bad}` })
      expect(res.status, bad).toBe(202)
    }
    // Token do Bruno apresentado no login da Ana
    const other = await call('POST', 'auth/login', { body: { email: EMAIL, password: PASSWORD }, cookie: `lv_device=${device}`, ip: '192.0.2.50' })
    expect([202, 429]).toContain(other.status)
    expect(other.cookies.lv_session).toBeUndefined()
    // O token do Bruno continua válido para ele
    const still = await login(USER, PASS, { deviceCookie: device })
    expect(still.data.trustedDevice).toBe(true)
    device = still.deviceCookie!
  })

  it('19. dispositivo com confiança vencida (30 dias) volta a pedir o código', async () => {
    const res = await login(USER, PASS, { deviceCookie: device })
    device = res.deviceCookie!
    await db.update(deviceTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(deviceTokens.tokenHash, sha256(device)))
    const expired = await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${device}` })
    expect(expired.status).toBe(202)
    device = (await login(USER, PASS, { trustDevice: true })).deviceCookie!
  })

  it('16/17. sair encerra a sessão, mas não revoga o dispositivo', async () => {
    const session = await login(USER, PASS, { deviceCookie: device })
    device = session.deviceCookie!
    const out = await call('POST', 'auth/logout', { cookie: session.cookie })
    expect(out.status).toBe(204)
    expect(out.cookies.lv_session).toBe('')
    expect(out.cookies.lv_device).toBeUndefined()
    expect((await call('GET', 'songs', { cookie: session.cookie })).status).toBe(401)
    const back = await login(USER, PASS, { deviceCookie: device })
    expect(back.data.trustedDevice).toBe(true)
    device = back.deviceCookie!
  })

  it('13/14. revogar um dispositivo: o próximo login nele pede código', async () => {
    const session = await login(USER, PASS, { deviceCookie: device })
    device = session.deviceCookie!
    const list = (await call('GET', 'auth/devices', { cookie: `${session.cookie}; lv_device=${device}` })).data as { id: string; current: boolean; status: string }[]
    const current = list.find((d) => d.current)!
    expect(current.status).toBe('active')
    const res = await call('POST', 'auth/devices-revoke', { cookie: `${session.cookie}; lv_device=${device}`, body: { id: current.id } })
    expect(res.status).toBe(204)
    expect(res.cookies.lv_device).toBe('')
    expect((await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${device}` })).status).toBe(202)
    expect(await events('DEVICE_REVOKED')).toBeGreaterThan(0)
  })

  it('não é possível revogar dispositivo de outra pessoa', async () => {
    const anaDevice = await login(EMAIL, PASSWORD, { trustDevice: true })
    const anaRow = (await db.select().from(deviceTokens).where(eq(deviceTokens.tokenHash, sha256(anaDevice.deviceCookie!))))[0]!
    const session = await login(USER, PASS)
    const res = await call('POST', 'auth/devices-revoke', { cookie: session.cookie, body: { id: anaRow.id } })
    expect(res.status).toBe(404)
    expect((await db.select().from(deviceTokens).where(eq(deviceTokens.id, anaRow.id)))[0]!.revokedAt).toBeNull()
  })

  it('15. revogar todos: sessão atual continua, todos os dispositivos passam a pedir código', async () => {
    const pc = await login(USER, PASS, { trustDevice: true })
    const phone = await login(USER, PASS, { trustDevice: true, userAgent: CHROME_ANDROID })
    const res = await call('POST', 'auth/devices-revoke-all', { cookie: pc.cookie, body: {} })
    expect(res.status).toBe(200)
    expect(res.data.revoked).toBeGreaterThanOrEqual(2)
    expect((await call('GET', 'songs', { cookie: pc.cookie })).status).toBe(200)
    expect((await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${pc.deviceCookie}` })).status).toBe(202)
    expect(
      (await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${phone.deviceCookie}`, userAgent: CHROME_ANDROID })).status,
    ).toBe(202)
    expect(await events('ALL_DEVICES_REVOKED')).toBe(1)
  })

  it('sair de todos: encerra todas as sessões e revoga os dispositivos', async () => {
    const a = await login(USER, PASS, { trustDevice: true })
    const b = await login(USER, PASS, { userAgent: CHROME_ANDROID })
    const res = await call('POST', 'auth/logout-all', { cookie: a.cookie, body: {} })
    expect(res.status).toBe(204)
    expect((await call('GET', 'songs', { cookie: a.cookie })).status).toBe(401)
    expect((await call('GET', 'songs', { cookie: b.cookie })).status).toBe(401)
    expect((await call('POST', 'auth/login', { body: { email: USER, password: PASS }, cookie: `lv_device=${a.deviceCookie}` })).status).toBe(202)
  })

  it('18. sessão expirada exige novo login', async () => {
    const s = await login(USER, PASS)
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) })
    expect((await call('GET', 'songs', { cookie: s.cookie })).status).toBe(401)
  })

  it('o token do dispositivo não é a sessão: sozinho não dá acesso', async () => {
    const res = await login(USER, PASS, { trustDevice: true })
    expect((await call('GET', 'songs', { cookie: `lv_device=${res.deviceCookie}` })).status).toBe(401)
  })

  it('administrador vê e revoga dispositivos de cada usuário; integrante não', async () => {
    adminCookie = (await login('admin.otp@gmail.com', 'senha-admin-123')).cookie
    const id = (await userByEmail(db, USER))!.id
    const list = await call('GET', `users/${id}/devices`, { cookie: adminCookie })
    expect(list.status).toBe(200)
    const active = (list.data as { id: string; status: string; browser: string; os: string }[]).find((d) => d.status === 'active')!
    expect(active).toMatchObject({ browser: 'Chrome', os: 'Windows' })
    expect(JSON.stringify(list.data)).not.toMatch(/tokenHash|token_hash/)
    const revoke = await call('POST', `users/${id}/devices/${active.id}/revoke`, { cookie: adminCookie, body: {} })
    expect(revoke.status).toBe(204)
    const member = await login(USER, PASS)
    expect((await call('GET', `users/${id}/devices`, { cookie: member.cookie })).status).toBe(403)
  })

  it('eventos de segurança são registrados', async () => {
    for (const type of ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'OTP_SENT', 'OTP_FAILED', 'OTP_VERIFIED', 'DEVICE_TRUSTED', 'DEVICE_REVOKED', 'ALL_DEVICES_REVOKED']) {
      expect(await events(type), type).toBeGreaterThan(0)
    }
  })
})
