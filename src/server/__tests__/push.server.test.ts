/**
 * Notificações push reais (Web Push + VAPID): um servidor HTTP local faz o papel do serviço
 * de push do navegador. O teste descriptografa o conteúdo com a chave privada do "aparelho",
 * exatamente como o navegador faz, e confere destinatários, deduplicação e falhas.
 */
import { createECDH, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { Agent, createServer, type Server } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { and, eq } from 'drizzle-orm'
import webpush from 'web-push'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../db/index'
import { runSeed } from '../../db/seed'
import { events, members, notificationDeliveryLogs, notifications, pushSubscriptions, rehearsals, repertoires, schedules } from '../../db/schema'
import { allowPushHostsForTests } from '../push'
import { call, login, setupDatabase, signupAndVerify, userByEmail } from './helpers'

const ece = createRequire(import.meta.url)('http_ece') as {
  decrypt: (body: Buffer, params: { version: string; privateKey: unknown; authSecret: string }) => Buffer
}

let db: Database
let close: () => Promise<void>
let server: Server
let base = ''
let admin = ''
let joao = ''
let maria = ''

interface Received {
  path: string
  headers: Record<string, string | string[] | undefined>
  body: Buffer
}
const received: Received[] = []

/** "Aparelho": par de chaves ECDH + segredo, como o navegador gera */
function device(name: string) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16).toString('base64url')
  return {
    ecdh,
    auth,
    subscription: { endpoint: `${base}/push/${name}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth } },
    /** Descriptografa as mensagens recebidas por este aparelho */
    messages: () =>
      received
        .filter((r) => r.path === `/push/${name}`)
        .map((r) => JSON.parse(ece.decrypt(r.body, { version: 'aes128gcm', privateKey: ecdh, authSecret: auth }).toString('utf8'))),
  }
}
type Device = ReturnType<typeof device>

const subscribe = (cookie: string, d: Device, auto = false) => call('POST', 'notifications/subscribe', { cookie, body: { subscription: d.subscription, auto } })
const dispatch = (cookie: string, event: string, entityId: string) => call('POST', 'notifications/dispatch', { cookie, body: { event, entityId } })

let pcJoao: Device
let phoneJoao: Device
let phoneMaria: Device
let repertoireId = ''
let rehearsalId = ''
let scheduleId = ''

beforeAll(async () => {
  ;({ db, close } = await setupDatabase())
  await runSeed(db)
  // Serviço de push local com HTTPS (como FCM/Mozilla/Apple), certificado gerado para o teste
  const dir = mkdtempSync(join(tmpdir(), 'push-'))
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')], { stdio: 'ignore' })
  server = createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const path = req.url ?? ''
      received.push({ path, headers: req.headers, body: Buffer.concat(chunks) })
      // Comportamento do "serviço de push" conforme o aparelho
      res.statusCode = path.includes('/gone-') ? 410 : path.includes('/fail-') ? 500 : 201
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`
  allowPushHostsForTests([/^127\.0\.0\.1:\d+$/], new Agent({ rejectUnauthorized: false }))
  const keys = webpush.generateVAPIDKeys()
  process.env.VAPID_PUBLIC_KEY = keys.publicKey
  process.env.VAPID_PRIVATE_KEY = keys.privateKey
  process.env.VAPID_SUBJECT = 'mailto:admin@louvor.test'

  // Admin, João (líder de louvor) e Maria (vocal), ligados aos integrantes da seed
  await signupAndVerify('Admin', 'admin.push@gmail.com', 'senha-admin-123')
  admin = (await login('admin.push@gmail.com', 'senha-admin-123')).cookie
  const memberId = async (name: string) => (await db.select().from(members).where(eq(members.name, name)))[0]!.id
  for (const [name, email, member] of [
    ['João Mendes', 'joao.push@gmail.com', 'João Mendes'],
    ['Maria Oliveira', 'maria.push@gmail.com', 'Maria Oliveira'],
  ] as const) {
    await signupAndVerify(name, email, 'senha-forte-123')
    const id = (await userByEmail(db, email))!.id
    await call('POST', `users/${id}/approve`, { cookie: admin, body: {} })
    await call('PATCH', `users/${id}`, { cookie: admin, body: { memberId: await memberId(member) } })
  }
  joao = (await login('joao.push@gmail.com', 'senha-forte-123')).cookie
  maria = (await login('maria.push@gmail.com', 'senha-forte-123')).cookie

  // Culto do próximo domingo: repertório publicado, escala e ensaio
  const [target] = await db
    .select({ repertoire: repertoires, event: events })
    .from(repertoires)
    .innerJoin(events, eq(events.id, repertoires.eventId))
    .where(eq(repertoires.status, 'published'))
  const upcoming = (await db.select({ repertoire: repertoires, event: events }).from(repertoires).innerJoin(events, eq(events.id, repertoires.eventId)))
    .filter((r) => r.repertoire.status === 'published' && r.event.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.event.date.localeCompare(b.event.date))[0]!
  expect(target).toBeDefined()
  repertoireId = upcoming.repertoire.id
  scheduleId = (await db.select().from(schedules).where(eq(schedules.eventId, upcoming.event.id)))[0]!.id
  const futureRehearsal = (await db.select({ r: rehearsals, e: events }).from(rehearsals).innerJoin(events, eq(events.id, rehearsals.eventId)))
    .filter((x) => x.e.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.e.date.localeCompare(b.e.date))[0]!
  rehearsalId = futureRehearsal.r.id
}, 90_000)

afterAll(async () => {
  allowPushHostsForTests([])
  for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) delete process.env[key]
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await close()
})

beforeEach(() => {
  received.length = 0
})

describe('inscrição dos aparelhos', () => {
  it('config entrega só a chave pública VAPID', async () => {
    const res = await call('GET', 'notifications/config')
    expect(res.data).toEqual({ publicKey: process.env.VAPID_PUBLIC_KEY, enabled: true })
    expect(JSON.stringify(res.data)).not.toContain(process.env.VAPID_PRIVATE_KEY!)
  })

  it('1/4/14. cada aparelho tem sua inscrição; repetir não duplica', async () => {
    pcJoao = device('ok-joao-pc')
    phoneJoao = device('ok-joao-phone')
    phoneMaria = device('ok-maria-phone')
    expect((await subscribe(joao, pcJoao)).status).toBe(201)
    expect((await subscribe(joao, phoneJoao)).status).toBe(201)
    expect((await subscribe(maria, phoneMaria)).status).toBe(201)
    const again = await subscribe(joao, pcJoao)
    expect(again.status).toBe(200)
    const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, pcJoao.subscription.endpoint))
    expect(rows).toHaveLength(1)
    const list = await call('GET', 'notifications/devices', { cookie: joao })
    expect(list.data).toHaveLength(2)
    expect(JSON.stringify(list.data)).not.toContain('/push/')
  })

  it('sem login ou com endereço fora dos serviços de push: recusado', async () => {
    expect((await subscribe('', device('ok-x'))).status).toBe(401)
    const evil = device('ok-evil')
    evil.subscription.endpoint = 'https://site-malicioso.example/coletar'
    expect((await subscribe(joao, evil)).status).toBe(400)
  })
})

describe('eventos → notificações push reais', () => {
  it('5/6/13/14. repertório novo: push criptografado para os aparelhos dos integrantes relacionados', async () => {
    const res = await dispatch(admin, 'REPERTOIRE_CREATED', repertoireId)
    expect(res.status).toBe(200)
    expect(res.data.created).toBeGreaterThanOrEqual(2)
    expect(res.data.pushed).toBe(3)
    for (const d of [pcJoao, phoneJoao, phoneMaria]) {
      const [msg] = d.messages()
      expect(msg).toMatchObject({ title: 'Louvor Videira', url: `/repertorios/${repertoireId}` })
      expect(msg.body).toMatch(/^Novo repertório disponível\n/)
      expect(msg.body).toContain('Confira as músicas e os tons')
    }
    // Requisição assinada com VAPID, com validade e urgência
    const headers = received[0]!.headers
    expect(String(headers.authorization)).toMatch(/^vapid t=.+, k=/)
    expect(headers.ttl).toBe('86400')
    expect(headers['content-encoding']).toBe('aes128gcm')
    const logs = await db.select().from(notificationDeliveryLogs).where(eq(notificationDeliveryLogs.status, 'SENT'))
    expect(logs.length).toBe(3)
  })

  it('19. o mesmo evento não gera notificação nem push duplicados', async () => {
    const res = await dispatch(admin, 'REPERTOIRE_CREATED', repertoireId)
    expect(res.data).toEqual({ created: 0, pushed: 0, failed: 0 })
    expect(received).toHaveLength(0)
  })

  it('quem cria não recebe o próprio aviso; integrante não dispara eventos', async () => {
    const adminId = (await userByEmail(db, 'admin.push@gmail.com'))!.id
    const own = await db.select().from(notifications).where(and(eq(notifications.userId, adminId), eq(notifications.entityId, repertoireId)))
    expect(own).toHaveLength(0)
    expect((await dispatch(maria, 'REPERTOIRE_CREATED', repertoireId)).status).toBe(403)
  })

  it('9/10. ensaio: mensagem com data e hora e link para o ensaio', async () => {
    const res = await dispatch(admin, 'REHEARSAL_CREATED', rehearsalId)
    expect(res.data.created).toBeGreaterThan(0)
    const [msg] = phoneJoao.messages()
    expect(msg.url).toBe(`/ensaios/${rehearsalId}`)
    expect(msg.body).toMatch(/Novo ensaio agendado para \d{2}\/\d{2} às \d{2}:\d{2}/)
  })

  it('11/12. escala: mensagem personalizada com a função de cada pessoa', async () => {
    const res = await dispatch(admin, 'SCHEDULE_CREATED', scheduleId)
    expect(res.data.created).toBeGreaterThanOrEqual(2)
    const [forJoao] = phoneJoao.messages()
    expect(forJoao.url).toBe(`/escalas/${scheduleId}`)
    expect(forJoao.body).toMatch(/^Você foi escalado\nVocê foi escalado como .*Líder de louvor.* para /)
    const [forMaria] = phoneMaria.messages()
    expect(forMaria.body).toMatch(/como Vocal/)
    // Nova alteração: quem já estava escalado recebe "escala atualizada"
    received.length = 0
    await dispatch(admin, 'SCHEDULE_UPDATED', scheduleId)
    expect(phoneJoao.messages()[0].body).toMatch(/^Escala atualizada/)
  })

  it('21/22. central: lista, marcar como lida e marcar todas', async () => {
    const list = (await call('GET', 'notifications', { cookie: maria })).data as { id: string; read: boolean; event: string }[]
    const mine = list.filter((n) => n.event)
    expect(mine.length).toBeGreaterThanOrEqual(3)
    expect(mine.every((n) => !n.read)).toBe(true)
    expect((await call('POST', 'notifications/read', { cookie: maria, body: { id: mine[0]!.id } })).status).toBe(204)
    const after = (await call('GET', 'notifications', { cookie: maria })).data as { id: string; read: boolean }[]
    expect(after.find((n) => n.id === mine[0]!.id)!.read).toBe(true)
    // João não marca notificação da Maria
    expect((await call('POST', 'notifications/read', { cookie: joao, body: { id: mine[0]!.id } })).status).toBe(404)
    const all = await call('POST', 'notifications/read-all', { cookie: maria, body: {} })
    expect(all.data.updated).toBeGreaterThan(0)
    const final = (await call('GET', 'notifications', { cookie: maria })).data as { read: boolean }[]
    expect(final.every((n) => n.read)).toBe(true)
  })

  it('20. preferências: categoria desligada não notifica; push desligado mantém só a central', async () => {
    const defaults = await call('GET', 'notifications/preferences', { cookie: maria })
    expect(defaults.data).toEqual({ repertoires: true, repertoireUpdates: true, rehearsals: true, schedules: true, general: true, pushEnabled: true })
    await call('PUT', 'notifications/preferences', { cookie: maria, body: { repertoireUpdates: false } })
    await call('PUT', 'notifications/preferences', { cookie: joao, body: { pushEnabled: false } })
    await dispatch(admin, 'REPERTOIRE_UPDATED', repertoireId)
    expect(phoneMaria.messages()).toHaveLength(0)
    expect(phoneJoao.messages()).toHaveLength(0)
    const joaoId = (await userByEmail(db, 'joao.push@gmail.com'))!.id
    const mariaId = (await userByEmail(db, 'maria.push@gmail.com'))!.id
    const updated = await db.select().from(notifications).where(eq(notifications.event, 'REPERTOIRE_UPDATED'))
    expect(updated.some((n) => n.userId === joaoId && n.sentAt === null)).toBe(true)
    expect(updated.some((n) => n.userId === mariaId)).toBe(false)
    await call('PUT', 'notifications/preferences', { cookie: joao, body: { pushEnabled: true } })
  })
})

describe('falhas e aparelhos', () => {
  it('16/17/18. inscrição expirada é desativada; falha não impede os outros aparelhos', async () => {
    const gone = device('gone-maria-old')
    const failing = device('fail-maria-tablet')
    await subscribe(maria, gone)
    await subscribe(maria, failing)
    await call('PUT', 'notifications/preferences', { cookie: maria, body: { repertoireUpdates: true } })
    // Novo aviso (janela de alteração diferente) para Maria: 1 ok, 1 expirada, 1 com erro
    await db.delete(notifications).where(eq(notifications.event, 'REPERTOIRE_UPDATED'))
    const res = await dispatch(admin, 'REPERTOIRE_UPDATED', repertoireId)
    expect(res.status).toBe(200)
    expect(phoneMaria.messages()).toHaveLength(1)
    const [goneRow] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, gone.subscription.endpoint))
    expect(goneRow!.active).toBe(false)
    const statuses = (await db.select().from(notificationDeliveryLogs)).map((l) => l.status)
    expect(statuses).toEqual(expect.arrayContaining(['SENT', 'EXPIRED', 'FAILED']))
    // Próximo envio não tenta mais a inscrição expirada
    received.length = 0
    await db.delete(notifications).where(eq(notifications.event, 'REPERTOIRE_UPDATED'))
    await dispatch(admin, 'REPERTOIRE_UPDATED', repertoireId)
    expect(received.some((r) => r.path.includes('gone-'))).toBe(false)
  })

  it('15. remover aparelho: para de receber; registro automático não o reativa, ativar de novo sim', async () => {
    const list = (await call('GET', 'notifications/devices', { cookie: joao })).data as { id: string }[]
    const pcRow = (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, pcJoao.subscription.endpoint)))[0]!
    expect(list.some((d) => d.id === pcRow.id)).toBe(true)
    expect((await call('DELETE', `notifications/devices/${pcRow.id}`, { cookie: joao })).status).toBe(204)
    expect((await call('DELETE', `notifications/devices/${pcRow.id}`, { cookie: maria })).status).toBe(404)
    const auto = await subscribe(joao, pcJoao, true)
    expect(auto.data.active).toBe(false)
    await db.delete(notifications).where(eq(notifications.event, 'REPERTOIRE_UPDATED'))
    await dispatch(admin, 'REPERTOIRE_UPDATED', repertoireId)
    expect(pcJoao.messages()).toHaveLength(0)
    expect(phoneJoao.messages()).toHaveLength(1)
    expect((await subscribe(joao, pcJoao)).data.active).toBe(true)
  })

  it('o aparelho passa para a conta logada nele (não fica com a anterior)', async () => {
    const shared = device('ok-shared')
    await subscribe(joao, shared)
    await subscribe(maria, shared)
    const [row] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, shared.subscription.endpoint))
    expect(row!.userId).toBe((await userByEmail(db, 'maria.push@gmail.com'))!.id)
    await call('DELETE', 'notifications/subscribe', { cookie: maria, body: { endpoint: shared.subscription.endpoint } })
    const [off] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, shared.subscription.endpoint))
    expect(off!.active).toBe(false)
  })

  it('administradores recebem push de nova solicitação de acesso', async () => {
    const adminPhone = device('ok-admin-phone')
    await subscribe(admin, adminPhone)
    await signupAndVerify('Pedro Novo', 'pedro.push@gmail.com', 'senha-forte-123')
    const [msg] = adminPhone.messages()
    expect(msg).toMatchObject({ title: 'Louvor Videira', url: '/admin' })
    expect(msg.body).toContain('Pedro Novo confirmou o e-mail')
  })

  it('notificação de teste e estatísticas do administrador', async () => {
    const test = await call('POST', 'notifications/test', { cookie: joao, body: {} })
    expect(test.data.pushed).toBeGreaterThan(0)
    expect(phoneJoao.messages().at(-1).body).toContain('Notificação de teste')
    const stats = await call('GET', 'notifications/stats', { cookie: admin })
    expect(stats.data).toMatchObject({ enabled: true })
    expect(stats.data.usersWithPush).toBeGreaterThanOrEqual(3)
    expect(stats.data.sent).toBeGreaterThan(0)
    expect(stats.data.failed).toBeGreaterThan(0)
    expect((await call('GET', 'notifications/stats', { cookie: maria })).status).toBe(403)
  })

  it('teste informa o motivo quando o serviço de push recusa o envio', async () => {
    await subscribe(maria, device('fail-maria-diag'))
    const test = await call('POST', 'notifications/test', { cookie: maria, body: {} })
    expect(test.status).toBe(200)
    expect(test.data).toMatchObject({ pushEnabled: true })
    expect(test.data.devices).toBeGreaterThan(0)
    expect(test.data.failed).toBeGreaterThan(0)
    expect(test.data.errors.join(' ')).toContain('HTTP 500')
  })

  it('aceita chaves coladas com aspas/espaços e recusa chaves inválidas com o motivo', async () => {
    const original = { pub: process.env.VAPID_PUBLIC_KEY!, priv: process.env.VAPID_PRIVATE_KEY! }
    try {
      process.env.VAPID_PUBLIC_KEY = ` "${original.pub}"\n`
      process.env.VAPID_PRIVATE_KEY = `'${original.priv}' `
      expect((await call('GET', 'health')).data.push).toBe('ok')
      const test = await call('POST', 'notifications/test', { cookie: joao, body: {} })
      expect(test.data.pushed).toBeGreaterThan(0)

      process.env.VAPID_PRIVATE_KEY = original.priv.slice(0, 20)
      expect((await call('GET', 'health')).data.push).toMatch(/^invalid/)
      const bad = await call('POST', 'notifications/test', { cookie: joao, body: {} })
      expect(bad.status).toBe(503)
      expect(bad.error?.message).toContain('Chaves VAPID inválidas')
      expect(bad.error?.message).not.toContain(original.priv.slice(0, 20))
    } finally {
      process.env.VAPID_PUBLIC_KEY = original.pub
      process.env.VAPID_PRIVATE_KEY = original.priv
    }
  })

  it('sem VAPID configurado: a central continua funcionando e nada quebra', async () => {
    const key = process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_PRIVATE_KEY
    try {
      await db.delete(notifications).where(eq(notifications.event, 'REPERTOIRE_UPDATED'))
      const res = await dispatch(admin, 'REPERTOIRE_UPDATED', repertoireId)
      expect(res.status).toBe(200)
      expect(res.data.created).toBeGreaterThan(0)
      expect(res.data.pushed).toBe(0)
      expect(received).toHaveLength(0)
    } finally {
      process.env.VAPID_PRIVATE_KEY = key
    }
  })
})
