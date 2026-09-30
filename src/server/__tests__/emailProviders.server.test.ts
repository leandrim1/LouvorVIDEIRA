/**
 * Envio pelo Gmail (SMTP com senha de app): um servidor SMTP local faz o papel do smtp.gmail.com,
 * exigindo usuário e senha. O cadastro completo recebe o link por esse caminho.
 */
import type { AddressInfo } from 'node:net'
import { SMTPServer } from 'smtp-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../db/index'
import { setEmailTransport } from '../email'
import { call, setupDatabase, userByEmail } from './helpers'

let db: Database
let close: () => Promise<void>
let server: SMTPServer
const received: { from: string; to: string[]; raw: string }[] = []
const USER = 'adminlouvorvideira@gmail.com'
const APP_PASSWORD = 'abcdefghijklmnop'

/** Decodifica quoted-printable (o suficiente para ler os links) */
const decode = (raw: string) =>
  Buffer.from(
    raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))),
    'latin1',
  ).toString('utf8')

beforeAll(async () => {
  ;({ db, close } = await setupDatabase())
  setEmailTransport(null)
  server = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth(auth, _session, cb) {
      if (auth.username === USER && auth.password === APP_PASSWORD) return cb(null, { user: auth.username })
      cb(Object.assign(new Error('535 5.7.8 Username and Password not accepted'), { responseCode: 535 }))
    },
    onData(stream, session, cb) {
      let raw = ''
      stream.on('data', (chunk: Buffer) => (raw += chunk.toString()))
      stream.on('end', () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
        })
        cb()
      })
    },
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  process.env.SMTP_HOST = '127.0.0.1'
  process.env.SMTP_PORT = String((server.server.address() as AddressInfo).port)
  process.env.GMAIL_USER = USER
  // Como o Google mostra: em blocos separados por espaço
  process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop'
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
}, 60_000)

afterAll(async () => {
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']) delete process.env[key]
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await close()
})

describe('Gmail (SMTP com senha de app)', () => {
  it('health informa o provedor em uso, sem expor credenciais', async () => {
    const res = await call('GET', 'health')
    expect(res.data.email).toBe('gmail')
    expect(JSON.stringify(res.data)).not.toContain('abcd')
  })

  it('cadastro envia o e-mail pelo Gmail, a partir da conta configurada, e o link funciona', async () => {
    const res = await call('POST', 'auth/signup', { body: { name: 'Ana Gmail', email: 'ana.gmail.teste@gmail.com', password: 'senha-forte-123' } })
    expect(res.status).toBe(201)
    const mail = received.at(-1)!
    expect(mail.from).toBe(USER)
    expect(mail.to).toEqual(['ana.gmail.teste@gmail.com'])
    const body = decode(mail.raw)
    expect(body).toMatch(/^From: Louvor Videira <adminlouvorvideira@gmail\.com>/m)
    const token = body.match(/verify-email\?token=([A-Za-z0-9_-]{43})/)![1]!
    const verify = await call('POST', 'auth/verify-email', { body: { token } })
    expect(verify.data.status).toBe('APPROVED')
  })

  it('código de acesso do login também chega pelo Gmail', async () => {
    const res = await call('POST', 'auth/login', { body: { email: 'ana.gmail.teste@gmail.com', password: 'senha-forte-123' } })
    expect(res.status).toBe(202)
    const code = decode(received.at(-1)!.raw).match(/Seu código de acesso é: (\d{6})/)![1]!
    const ok = await call('POST', 'auth/login-verify', { body: { code }, cookie: `lv_login=${res.cookies.lv_login}` })
    expect(ok.status).toBe(200)
  })

  it('senha de app errada: erro amigável (502) e o cadastro novo é desfeito', async () => {
    process.env.GMAIL_APP_PASSWORD = 'senha-errada'
    try {
      const res = await call('POST', 'auth/signup', { body: { name: 'Bruno', email: 'bruno.gmail.teste@gmail.com', password: 'senha-forte-123' } })
      expect(res.status).toBe(502)
      expect(res.error?.message).toBe('Não foi possível enviar o e-mail agora. Tente novamente em instantes.')
      expect(await userByEmail(db, 'bruno.gmail.teste@gmail.com')).toBeUndefined()
    } finally {
      process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop'
    }
  })

  it('sem Gmail nem Resend: mensagem diz exatamente o que configurar', async () => {
    delete process.env.GMAIL_APP_PASSWORD
    try {
      const res = await call('POST', 'auth/signup', { body: { name: 'Carla', email: 'carla.gmail.teste@gmail.com', password: 'senha-forte-123' } })
      expect(res.status).toBe(503)
      expect(res.error?.message).toContain('GMAIL_USER e GMAIL_APP_PASSWORD')
    } finally {
      process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop'
    }
  })
})
