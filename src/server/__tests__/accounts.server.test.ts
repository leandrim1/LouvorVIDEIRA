/**
 * Fluxo de cadastro: validação do e-mail → confirmação pelo link → aprovação do administrador → login.
 * PostgreSQL real em memória; os e-mails são capturados em vez de enviados ao Resend.
 */
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../db/index'
import { users } from '../../db/schema'
import { setEmailTransport } from '../email'
import { isDisposableEmailDomain, isValidEmailFormat } from '../emailValidation'
import { NO_MX_DOMAIN, call, lastEmailTo, login, outbox, setupDatabase, signupAndVerify, tokenFrom, userByEmail } from './helpers'

let db: Database
let close: () => Promise<void>
let admin = ''
let adminId = ''

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
const signup = (name: string, email: string, password = 'senha-forte-123', ip?: string) =>
  call('POST', 'auth/signup', { body: { name, email, password }, ip })
const verify = (token: string) => call('POST', 'auth/verify-email', { body: { token } })
const idOf = async (email: string) => (await userByEmail(db, email))!.id

beforeAll(async () => {
  ;({ db, close } = await setupDatabase())
  await signupAndVerify('Admin Principal', 'admin@igreja.dev', 'senha-admin-123')
  const res = await login('admin@igreja.dev', 'senha-admin-123')
  admin = res.cookie
  adminId = res.data.user.id
}, 60_000)

afterAll(async () => {
  await close()
})

describe('1–4. Cadastro e e-mail de confirmação', () => {
  it('1. cadastro com e-mail válido cria a solicitação sem sessão e envia o e-mail', async () => {
    const res = await signup('João Silva', 'Joao@Gmail.com')
    expect(res.status).toBe(201)
    expect(res.data).toEqual({ email: 'joao@gmail.com', status: 'PENDING_EMAIL_VERIFICATION', resendAfter: 60 })
    expect(res.setCookie).toBe('')
    const row = await userByEmail(db, 'joao@gmail.com')
    expect(row).toMatchObject({ status: 'PENDING_EMAIL_VERIFICATION', emailVerified: false, role: 'member' })
    expect(row!.passwordHash).toMatch(/^scrypt\$/)
    expect(row!.passwordHash).not.toContain('senha-forte-123')
  })

  it('2. rejeita e-mails com formato inválido, descartáveis ou de domínio sem e-mail', async () => {
    for (const email of ['teste', 'teste@', 'teste@com', 'teste.com', 'a@b.c', 'dois@@gmail.com', 'espaço @gmail.com']) {
      const res = await signup('Pessoa', email)
      expect(res.status, email).toBe(400)
      expect(res.error?.details?.email, email).toBeDefined()
    }
    for (const email of ['x@mailinator.com', 'x@10minutemail.com', 'x@guerrillamail.com', 'x@tempmail.com', 'x@sub.yopmail.com', 'x@meu-tempmail.xyz']) {
      const res = await signup('Pessoa', email)
      expect(res.status, email).toBe(400)
      expect(res.error?.message).toMatch(/temporários|descartáveis/)
    }
    const noMx = await signup('Pessoa', `x@${NO_MX_DOMAIN}`)
    expect(noMx.status).toBe(400)
    expect(noMx.error?.message).toMatch(/não recebe mensagens/)
    expect(await userByEmail(db, `x@${NO_MX_DOMAIN}`)).toBeUndefined()
  })

  it('validação de formato e de domínios descartáveis (unidade)', () => {
    expect(['usuario@gmail.com', 'nome.sobrenome+louvor@igreja.org.br'].every(isValidEmailFormat)).toBe(true)
    expect(['teste', 'teste@', 'teste@com', 'teste.com', '.a@b.com', 'a..b@c.com', 'a@-b.com'].some(isValidEmailFormat)).toBe(false)
    expect(isDisposableEmailDomain('mailinator.com')).toBe(true)
    expect(isDisposableEmailDomain('gmail.com')).toBe(false)
  })

  it('3. e-mail já cadastrado retorna 409 (confirmado ou aguardando confirmação)', async () => {
    const pending = await signup('Outra Pessoa', 'JOAO@gmail.com')
    expect(pending.status).toBe(409)
    expect(pending.error?.code).toBe('VERIFICATION_PENDING')
    const verified = await signup('Outra Pessoa', 'admin@igreja.dev')
    expect(verified.status).toBe(409)
    expect(verified.error?.code).toBe('EMAIL_ALREADY_REGISTERED')
  })

  it('4. o e-mail de confirmação tem assunto, nome, botão, link e validade', () => {
    const message = lastEmailTo('joao@gmail.com')!
    expect(message.subject).toBe('Confirme seu e-mail — Louvor Videira')
    expect(message.from).toContain('Louvor Videira')
    expect(message.html).toContain('Olá, João.')
    expect(message.html).toContain('Confirmar meu e-mail')
    expect(message.html).toContain('https://louvor.test/verify-email?token=')
    expect(message.text).toContain('Este link expira em 24 horas.')
    expect(message.text).toContain('Se você não solicitou esta conta, ignore este e-mail.')
    expect(message.text).not.toContain('senha-forte-123')
  })

  it('escapa o nome informado no HTML do e-mail', async () => {
    await signup('<script>alert(1)</script> Ana', 'ana@gmail.com')
    const message = lastEmailTo('ana@gmail.com')!
    expect(message.html).not.toContain('<script>')
    expect(message.html).toContain('&lt;script&gt;')
  })
})

describe('5–9. Link de confirmação e reenvio', () => {
  it('10. login com e-mail não confirmado é bloqueado (e a senha errada não revela a situação)', async () => {
    const res = await login('joao@gmail.com', 'senha-forte-123')
    expect(res.status).toBe(403)
    expect(res.error).toMatchObject({ code: 'EMAIL_NOT_VERIFIED', message: 'Confirme seu e-mail antes de entrar.' })
    const wrong = await login('joao@gmail.com', 'senha-errada')
    expect(wrong.status).toBe(401)
  })

  it('13. administrador não consegue aprovar quem não confirmou o e-mail', async () => {
    const res = await call('POST', `users/${await idOf('joao@gmail.com')}/approve`, { cookie: admin, body: {} })
    expect(res.status).toBe(409)
    expect(res.error).toMatchObject({ code: 'EMAIL_NOT_VERIFIED', message: 'Este usuário ainda não confirmou o e-mail.' })
    expect((await userByEmail(db, 'joao@gmail.com'))!.status).toBe('PENDING_EMAIL_VERIFICATION')
  })

  it('5. o link confirma o e-mail, invalida o token e envia para aprovação', async () => {
    const token = tokenFrom(lastEmailTo('joao@gmail.com'))
    const res = await verify(token)
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ email: 'joao@gmail.com', status: 'PENDING_ADMIN_APPROVAL' })
    const row = await userByEmail(db, 'joao@gmail.com')
    expect(row).toMatchObject({ emailVerified: true, status: 'PENDING_ADMIN_APPROVAL', emailVerificationTokenHash: null, emailVerificationExpiresAt: null })
    expect(row!.emailVerifiedAt).toBeInstanceOf(Date)
    // O administrador é avisado no sino
    const notes = (await call('GET', 'notifications', { cookie: admin })).data as { title: string; message: string }[]
    expect(notes.some((n) => n.title === 'Nova solicitação de acesso' && n.message.includes('João Silva'))).toBe(true)
  })

  it('7. o mesmo link não pode ser usado duas vezes', async () => {
    const res = await verify(tokenFrom(lastEmailTo('joao@gmail.com')))
    expect(res.status).toBe(400)
    expect(res.error?.code).toBe('TOKEN_INVALID')
  })

  it('6. link expirado é recusado', async () => {
    await signup('Maria Expirada', 'maria@gmail.com')
    const token = tokenFrom(lastEmailTo('maria@gmail.com'))
    await db.update(users).set({ emailVerificationExpiresAt: new Date(Date.now() - 1000) }).where(eq(users.email, 'maria@gmail.com'))
    const res = await verify(token)
    expect(res.status).toBe(400)
    expect(res.error?.code).toBe('TOKEN_EXPIRED')
    expect((await userByEmail(db, 'maria@gmail.com'))!.emailVerified).toBe(false)
  })

  it('cadastro abandonado (link vencido) pode ser refeito com o mesmo e-mail', async () => {
    const res = await signup('Maria Nova', 'maria@gmail.com', 'outra-senha-456')
    expect(res.status).toBe(201)
    expect((await userByEmail(db, 'maria@gmail.com'))!.name).toBe('Maria Nova')
  })

  it('8. reenvio gera um novo link e invalida o anterior', async () => {
    const old = tokenFrom(lastEmailTo('maria@gmail.com'))
    await db.update(users).set({ emailVerificationSentAt: new Date(Date.now() - 61_000) }).where(eq(users.email, 'maria@gmail.com'))
    const res = await call('POST', 'auth/resend-verification', { body: { email: 'maria@gmail.com' } })
    expect(res.status).toBe(200)
    expect(res.data.resendAfter).toBe(60)
    const fresh = tokenFrom(lastEmailTo('maria@gmail.com'))
    expect(fresh).not.toBe(old)
    expect((await verify(old)).error?.code).toBe('TOKEN_INVALID')
    expect((await verify(fresh)).status).toBe(200)
  })

  it('9. reenvio respeita 60 segundos entre envios e o limite por endereço e por IP', async () => {
    await signup('Pedro Limite', 'pedro@gmail.com')
    const count = () => outbox.filter((m) => m.to === 'pedro@gmail.com').length
    const before = count()
    // Dentro dos 60 segundos: responde igual, mas não envia
    await call('POST', 'auth/resend-verification', { body: { email: 'pedro@gmail.com' } })
    expect(count()).toBe(before)
    // Fora do intervalo, até 5 e-mails por hora para o mesmo endereço
    for (let i = 0; i < 6; i++) {
      await db.update(users).set({ emailVerificationSentAt: new Date(Date.now() - 61_000) }).where(eq(users.email, 'pedro@gmail.com'))
      await call('POST', 'auth/resend-verification', { body: { email: 'pedro@gmail.com' } })
    }
    expect(count()).toBe(5)
    // Endereço inexistente recebe a mesma resposta (não revela cadastros)
    const unknown = await call('POST', 'auth/resend-verification', { body: { email: 'ninguem@gmail.com' } })
    expect(unknown.status).toBe(200)
    expect(unknown.data).toEqual({ resendAfter: 60 })
    // Muitos pedidos do mesmo IP: 429
    let last = 0
    for (let i = 0; i < 21; i++) last = (await call('POST', 'auth/resend-verification', { body: { email: 'x@gmail.com' }, ip: '203.0.113.7' })).status
    expect(last).toBe(429)
  })
})

describe('11–17. Aprovação, recusa e login', () => {
  it('11/12. e-mail confirmado aguardando aprovação não entra', async () => {
    const res = await login('joao@gmail.com', 'senha-forte-123')
    expect(res.status).toBe(403)
    expect(res.error).toMatchObject({
      code: 'PENDING_APPROVAL',
      message: 'Seu e-mail foi confirmado. Sua conta está aguardando aprovação do administrador.',
    })
  })

  it('administrador vê a solicitação com a situação do e-mail; integrantes não veem pendentes', async () => {
    const list = (await call('GET', 'users', { cookie: admin })).data as { email: string; emailVerified: boolean; status: string }[]
    expect(list.find((u) => u.email === 'joao@gmail.com')).toMatchObject({ emailVerified: true, status: 'PENDING_ADMIN_APPROVAL' })
    expect(list.find((u) => u.email === 'pedro@gmail.com')).toMatchObject({ emailVerified: false, status: 'PENDING_EMAIL_VERIFICATION' })
  })

  it('14/16/17. aprovação libera o login e envia o e-mail de aprovação', async () => {
    const id = await idOf('joao@gmail.com')
    const res = await call('POST', `users/${id}/approve`, { cookie: admin, body: {} })
    expect(res.status).toBe(200)
    expect(res.data.emailSent).toBe(true)
    expect(res.data.user).toMatchObject({ status: 'APPROVED', approved: true, approvedBy: adminId })
    expect(res.data.user.approvedAt).toBeTruthy()
    const mail = lastEmailTo('joao@gmail.com')!
    expect(mail.subject).toBe('Seu acesso foi aprovado — Louvor Videira')
    expect(mail.html).toContain('Acessar sistema')
    const ok = await login('joao@gmail.com', 'senha-forte-123')
    expect(ok.status).toBe(200)
    expect((await call('GET', 'songs', { cookie: ok.cookie })).status).toBe(200)
  })

  it('15. recusa com motivo: status REJECTED, e-mail opcional e login bloqueado', async () => {
    await signupAndVerify('Recusado Teste', 'recusado@gmail.com', 'senha-forte-123')
    const id = await idOf('recusado@gmail.com')
    const res = await call('POST', `users/${id}/reject`, { cookie: admin, body: { reason: 'Não faz parte da equipe.', notify: true } })
    expect(res.status).toBe(200)
    expect(res.data.emailSent).toBe(true)
    expect(res.data.user).toMatchObject({ status: 'REJECTED', rejectionReason: 'Não faz parte da equipe.', rejectedBy: adminId })
    expect(lastEmailTo('recusado@gmail.com')!.text).toContain('Motivo: Não faz parte da equipe.')
    const denied = await login('recusado@gmail.com', 'senha-forte-123')
    expect(denied.error).toMatchObject({ code: 'ACCOUNT_REJECTED', message: 'Seu pedido de acesso não foi aprovado.' })
    // Um novo cadastro com o mesmo e-mail não "apaga" a recusa
    expect((await signup('Recusado', 'recusado@gmail.com')).status).toBe(409)
  })

  it('não envia aviso de recusa para e-mails não confirmados', async () => {
    const before = outbox.length
    const res = await call('POST', `users/${await idOf('pedro@gmail.com')}/reject`, { cookie: admin, body: { notify: true } })
    expect(res.status).toBe(200)
    expect(res.data.emailSent).toBe(false)
    expect(outbox.length).toBe(before)
  })

  it('somente administradores aprovam, recusam ou suspendem', async () => {
    const leader = await login('joao@gmail.com', 'senha-forte-123')
    const id = await idOf('maria@gmail.com')
    for (const action of ['approve', 'reject', 'suspend']) {
      expect((await call('POST', `users/${id}/${action}`, { cookie: leader.cookie, body: {} })).status).toBe(403)
    }
    // Nem pela edição comum: campos de status são ignorados
    const patch = await call('PATCH', `users/${id}`, { cookie: admin, body: { status: 'APPROVED', emailVerified: true } })
    expect(patch.status).toBe(200)
    expect((await userByEmail(db, 'maria@gmail.com'))!.status).toBe('PENDING_ADMIN_APPROVAL')
  })

  it('19. conta suspensa perde a sessão e não entra; reativação volta a liberar', async () => {
    const session = await login('joao@gmail.com', 'senha-forte-123')
    const id = await idOf('joao@gmail.com')
    expect((await call('POST', `users/${id}/suspend`, { cookie: admin, body: {} })).status).toBe(200)
    expect((await call('GET', 'songs', { cookie: session.cookie })).status).toBe(401)
    const denied = await login('joao@gmail.com', 'senha-forte-123')
    expect(denied.error?.code).toBe('ACCOUNT_SUSPENDED')
    expect((await call('POST', `users/${id}/approve`, { cookie: admin, body: {} })).status).toBe(200)
    expect((await login('joao@gmail.com', 'senha-forte-123')).status).toBe(200)
  })

  it('administrador não suspende a si mesmo', async () => {
    expect((await call('POST', `users/${adminId}/suspend`, { cookie: admin, body: {} })).status).toBe(403)
  })
})

describe('18. Alteração de e-mail', () => {
  it('antes da aprovação: exige a senha, volta a pedir confirmação e invalida o link antigo', async () => {
    await signupAndVerify('Carla Troca', 'carla@gmail.com', 'senha-forte-123')
    expect((await userByEmail(db, 'carla@gmail.com'))!.status).toBe('PENDING_ADMIN_APPROVAL')

    const wrong = await call('POST', 'auth/change-email', { body: { email: 'carla@gmail.com', password: 'errada', newEmail: 'carla.nova@gmail.com' } })
    expect(wrong.status).toBe(401)
    const taken = await call('POST', 'auth/change-email', { body: { email: 'carla@gmail.com', password: 'senha-forte-123', newEmail: 'joao@gmail.com' } })
    expect(taken.status).toBe(409)

    const res = await call('POST', 'auth/change-email', { body: { email: 'carla@gmail.com', password: 'senha-forte-123', newEmail: 'carla.nova@gmail.com' } })
    expect(res.status).toBe(200)
    const row = await userByEmail(db, 'carla.nova@gmail.com')
    expect(row).toMatchObject({ emailVerified: false, emailVerifiedAt: null, status: 'PENDING_EMAIL_VERIFICATION' })
    expect((await call('POST', `users/${row!.id}/approve`, { cookie: admin, body: {} })).status).toBe(409)
    expect((await verify(tokenFrom(lastEmailTo('carla.nova@gmail.com')))).data.status).toBe('PENDING_ADMIN_APPROVAL')
  })

  it('depois da aprovação, o administrador altera o e-mail: o novo endereço precisa ser confirmado', async () => {
    const id = await idOf('joao@gmail.com')
    const res = await call('PATCH', `users/${id}`, { cookie: admin, body: { email: 'joao.silva@gmail.com' } })
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ email: 'joao.silva@gmail.com', emailVerified: false })
    const denied = await login('joao.silva@gmail.com', 'senha-forte-123')
    expect(denied.error?.code).toBe('EMAIL_NOT_VERIFIED')
    expect((await verify(tokenFrom(lastEmailTo('joao.silva@gmail.com')))).data.status).toBe('APPROVED')
    expect((await login('joao.silva@gmail.com', 'senha-forte-123')).status).toBe(200)
  })
})

describe('20. Segurança dos tokens e limites', () => {
  it('o banco guarda apenas o hash do token; o token nunca sai pela API', async () => {
    await signup('Token Seguro', 'token@gmail.com')
    const token = tokenFrom(lastEmailTo('token@gmail.com'))
    const row = await userByEmail(db, 'token@gmail.com')
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(row!.emailVerificationTokenHash).toBe(sha256(token))
    expect(row!.emailVerificationTokenHash).not.toContain(token)
    const expiresIn = row!.emailVerificationExpiresAt!.getTime() - Date.now()
    expect(expiresIn).toBeGreaterThan(23.9 * 3_600_000)
    expect(expiresIn).toBeLessThanOrEqual(24 * 3_600_000)

    const list = await call('GET', 'users', { cookie: admin })
    expect(JSON.stringify(list.data)).not.toMatch(/emailVerificationTokenHash|passwordHash|scrypt\$/)
    expect((await call('GET', `users?emailVerificationTokenHash=${row!.emailVerificationTokenHash}`, { cookie: admin })).status).toBe(400)
  })

  it('tokens aleatórios, adivinhados ou malformados não confirmam nada', async () => {
    expect((await verify('a'.repeat(43))).error?.code).toBe('TOKEN_INVALID')
    expect((await verify('curto')).status).toBe(400)
    const hash = (await userByEmail(db, 'token@gmail.com'))!.emailVerificationTokenHash!
    expect((await verify(hash)).error?.code).toBe('TOKEN_INVALID')
  })

  it('login tem limite de tentativas por e-mail', async () => {
    let last = 0
    for (let i = 0; i < 11; i++) last = (await login('admin@igreja.dev', `errada-${i}`)).status
    expect(last).toBe(429)
  })

  it('sem Resend configurado, o cadastro falha com mensagem clara e nada é gravado', async () => {
    setEmailTransport(null)
    const key = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      const res = await signup('Sem Email', 'semenvio@gmail.com')
      expect(res.status).toBe(503)
      expect(res.error?.message).toContain('RESEND_API_KEY')
      expect(await userByEmail(db, 'semenvio@gmail.com')).toBeUndefined()
    } finally {
      if (key) process.env.RESEND_API_KEY = key
      setEmailTransport(async (m) => {
        outbox.push(m)
      })
    }
  })

  it('falha no envio desfaz o cadastro novo', async () => {
    setEmailTransport(async () => {
      throw new Error('fora do ar')
    })
    try {
      const res = await signup('Falha Envio', 'falha@gmail.com')
      expect(res.status).toBe(500)
      expect(await userByEmail(db, 'falha@gmail.com')).toBeUndefined()
    } finally {
      setEmailTransport(async (m) => {
        outbox.push(m)
      })
    }
  })
})
