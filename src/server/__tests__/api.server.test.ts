/**
 * Testes da API contra um PostgreSQL real em memória (PGlite), com as mesmas
 * migrations e o mesmo seed usados no Neon.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setDb, type Database } from '../../db/index'
import { openLocalDatabase } from '../../db/local'
import { runSeed } from '../../db/seed'
import { handleRequest } from '../router'

const ORIGIN = 'http://louvor.test'
let db: Database
let close: () => Promise<void>

interface CallOptions {
  body?: unknown
  cookie?: string
  origin?: string | null
  form?: FormData
}

async function call(method: string, path: string, options: CallOptions = {}) {
  const headers = new Headers({ host: 'louvor.test' })
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
  const json = text ? (JSON.parse(text) as { data?: any; error?: { code: string; message: string; details?: Record<string, string[]> } }) : {}
  const setCookie = response.headers.get('set-cookie') ?? ''
  return { status: response.status, data: json.data, error: json.error, setCookie, cookie: setCookie.split(';')[0] ?? '' }
}

let admin = ''
let member = ''
let memberUserId = ''

beforeAll(async () => {
  const local = await openLocalDatabase('memory://')
  db = local.db
  close = local.close
  setDb(db)
  await runSeed(db)
}, 60_000)

afterAll(async () => {
  setDb(null)
  await close()
})

describe('saúde e rotas', () => {
  it('GET /api/health confirma a conexão com o banco', async () => {
    const res = await call('GET', 'health')
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ status: 'ok', database: 'ok' })
  })

  it('rota inexistente retorna 404', async () => {
    expect((await call('GET', 'nada')).status).toBe(404)
  })

  it('exige login para ler dados (401)', async () => {
    const res = await call('GET', 'songs')
    expect(res.status).toBe(401)
    expect(res.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('autenticação', () => {
  it('primeira conta vira administrador e recebe cookie httpOnly', async () => {
    const session = await call('GET', 'auth/session')
    expect(session.data).toEqual({ user: null, setupRequired: true })

    const res = await call('POST', 'auth/signup', { body: { name: 'Admin', email: 'Admin@Teste.dev', password: 'senha-segura-1' } })
    expect(res.status).toBe(201)
    expect(res.data.user).toMatchObject({ role: 'admin', approved: true, email: 'admin@teste.dev', registered: true })
    expect(res.data.user).not.toHaveProperty('passwordHash')
    expect(res.setCookie).toMatch(/HttpOnly/)
    expect(res.setCookie).toMatch(/SameSite=Lax/)
    admin = res.cookie
  })

  it('próximas contas aguardam aprovação (403 nos dados)', async () => {
    const res = await call('POST', 'auth/signup', { body: { name: 'Integrante', email: 'membro@teste.dev', password: 'senha-segura-2' } })
    expect(res.status).toBe(201)
    expect(res.data.user).toMatchObject({ role: 'member', approved: false })
    member = res.cookie
    memberUserId = res.data.user.id
    expect((await call('GET', 'songs', { cookie: member })).status).toBe(403)
  })

  it('e-mail repetido retorna 409', async () => {
    const res = await call('POST', 'auth/signup', { body: { name: 'Outro', email: 'MEMBRO@teste.dev', password: 'senha-segura-3' } })
    expect(res.status).toBe(409)
  })

  it('login inválido responde 401 com a mesma mensagem para e-mail ou senha errados', async () => {
    const wrongPassword = await call('POST', 'auth/login', { body: { email: 'admin@teste.dev', password: 'errada-123' } })
    const unknownEmail = await call('POST', 'auth/login', { body: { email: 'ninguem@teste.dev', password: 'errada-123' } })
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.error?.message).toBe(unknownEmail.error?.message)
  })

  it('valida os dados de cadastro (400)', async () => {
    const res = await call('POST', 'auth/signup', { body: { name: '', email: 'invalido', password: '123' } })
    expect(res.status).toBe(400)
    expect(Object.keys(res.error?.details ?? {})).toEqual(expect.arrayContaining(['name', 'email', 'password']))
  })

  it('bloqueia requisições de outra origem (CSRF)', async () => {
    const res = await call('POST', 'songs', { cookie: admin, origin: 'https://site-malicioso.example', body: {} })
    expect(res.status).toBe(403)
  })
})

describe('seed e relacionamentos', () => {
  it('carrega os dados de desenvolvimento', async () => {
    const counts = await Promise.all(
      ['songs', 'members', 'repertoires', 'rehearsals', 'schedules', 'notifications'].map(async (r) => (await call('GET', r, { cookie: admin })).data.length),
    )
    expect(counts).toEqual([15, 8, 5, 3, 3, 10])
    const events = (await call('GET', 'events', { cookie: admin })).data as { type: string; startTime: string; date: string }[]
    expect(events.filter((e) => e.type !== 'rehearsal')).toHaveLength(5)
    expect(events[0]!.startTime).toMatch(/^\d{2}:\d{2}$/)
    expect(events[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('itens do repertório apontam para músicas e repertórios existentes', async () => {
    const [songs, repertoires, items] = await Promise.all(
      ['songs', 'repertoires', 'repertoire-songs'].map(async (r) => (await call('GET', r, { cookie: admin })).data as { id: string }[]),
    )
    const songIds = new Set(songs!.map((s) => s.id))
    const repIds = new Set(repertoires!.map((r) => r.id))
    for (const item of items as unknown as { songId: string; repertoireId: string }[]) {
      expect(songIds.has(item.songId)).toBe(true)
      expect(repIds.has(item.repertoireId)).toBe(true)
    }
    const first = repertoires![0]!.id
    const filtered = (await call('GET', `repertoire-songs?repertoireId=${first}`, { cookie: admin })).data as { repertoireId: string }[]
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((i) => i.repertoireId === first)).toBe(true)
  })

  it('agrupa leituras em /api/batch', async () => {
    const res = await call('POST', 'batch', { cookie: admin, body: { requests: [{ path: 'songs' }, { path: 'members?active=true' }, { path: 'nada' }] } })
    expect(res.status).toBe(200)
    expect(res.data.map((r: { status: number }) => r.status)).toEqual([200, 200, 404])
    expect(res.data[1].data).toHaveLength(8)
  })
})

describe('permissões verificadas no servidor', () => {
  it('administrador aprova o integrante', async () => {
    const res = await call('PATCH', `users/${memberUserId}`, { cookie: admin, body: { approved: true } })
    expect(res.status).toBe(200)
    expect(res.data.approved).toBe(true)
    expect((await call('GET', 'songs', { cookie: member })).status).toBe(200)
  })

  it('integrante não cria músicas nem altera o próprio nível de acesso', async () => {
    expect((await call('POST', 'songs', { cookie: member, body: { title: 'X', artist: 'Y', originalKey: 'G', teamKey: 'G' } })).status).toBe(403)
    const escalate = await call('PATCH', `users/${memberUserId}`, { cookie: member, body: { role: 'admin' } })
    expect(escalate.status).toBe(403)
    const me = await call('GET', 'auth/session', { cookie: member })
    expect(me.data.user.role).toBe('member')
  })

  it('ignora campos que o cliente não pode definir (senha, datas)', async () => {
    const res = await call('POST', 'users', {
      cookie: admin,
      body: { name: 'Convite', email: 'convite@teste.dev', role: 'leader', approved: true, passwordHash: 'hack', createdAt: '2000-01-01T00:00:00Z' },
    })
    expect(res.status).toBe(201)
    expect(res.data.registered).toBe(false)
    expect(res.data.createdAt.startsWith('2000')).toBe(false)
  })

  it('convite só é liberado após aprovação do administrador', async () => {
    const res = await call('POST', 'auth/signup', { body: { name: 'Convite', email: 'convite@teste.dev', password: 'senha-segura-4' } })
    expect(res.status).toBe(201)
    expect(res.data.user).toMatchObject({ role: 'leader', approved: false })
  })

  it('não permite remover o último administrador', async () => {
    const me = await call('GET', 'auth/session', { cookie: admin })
    const res = await call('PATCH', `users/${me.data.user.id}`, { cookie: admin, body: { role: 'member' } })
    expect(res.status).toBe(409)
  })

  it('favoritos são pessoais', async () => {
    const [song] = (await call('GET', 'songs', { cookie: admin })).data as { id: string }[]
    // O app envia a linha completa (com datas em texto); o servidor ignora usuário e data enviados
    const created = await call('POST', 'favorites', { cookie: admin, body: { id: crypto.randomUUID(), songId: song!.id, userId: memberUserId, createdAt: '2000-01-01T00:00:00Z' } })
    expect(created.status).toBe(201)
    expect(created.data.userId).not.toBe(memberUserId)
    const view = await call('POST', 'song-views', { cookie: member, body: { songId: song!.id, userId: 'x', viewedAt: '2000-01-01T00:00:00Z' } })
    expect(view.status).toBe(201)
    expect((await call('POST', 'favorites', { cookie: admin, body: { songId: song!.id } })).status).toBe(409)
    expect((await call('GET', 'favorites', { cookie: admin })).data).toHaveLength(1)
    expect((await call('GET', 'favorites', { cookie: member })).data).toHaveLength(0)
  })

  it('integrante só marca notificações como lidas para si', async () => {
    const [notification] = (await call('GET', 'notifications', { cookie: member })).data as { id: string }[]
    const me = (await call('GET', 'auth/session', { cookie: member })).data.user.id as string
    const ok = await call('PATCH', `notifications/${notification!.id}`, { cookie: member, body: { readBy: [me] } })
    expect(ok.status).toBe(200)
    const other = await call('PATCH', `notifications/${notification!.id}`, { cookie: member, body: { readBy: [me, crypto.randomUUID()] } })
    expect(other.status).toBe(403)
  })

  it('integrante não cria avisos para a equipe', async () => {
    const res = await call('POST', 'notifications', { cookie: member, body: { type: 'system', title: 'Spam', message: 'Spam' } })
    expect(res.status).toBe(403)
  })

  it('endereço malformado retorna 400', async () => {
    expect((await call('GET', 'songs/%E0%A4%A', { cookie: admin })).status).toBe(400)
  })

  it('exclusão em lote exige filtro', async () => {
    expect((await call('DELETE', 'song-videos', { cookie: admin })).status).toBe(400)
  })

  it('backup é exclusivo do administrador e nunca inclui senhas', async () => {
    expect((await call('GET', 'export', { cookie: member })).status).toBe(403)
    const res = await call('GET', 'export', { cookie: admin })
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.data)).not.toContain('scrypt$')
    expect(res.data).not.toHaveProperty('sessions')
  })
})

describe('validação e erros', () => {
  it('valida os campos (400 com detalhes)', async () => {
    const res = await call('POST', 'songs', { cookie: admin, body: { title: '', artist: 'A', originalKey: 'H', teamKey: 'G', bpm: 999 } })
    expect(res.status).toBe(400)
    expect(Object.keys(res.error?.details ?? {})).toEqual(expect.arrayContaining(['title', 'originalKey', 'bpm']))
  })

  it('cria, altera e exclui uma música (201/200/204/404)', async () => {
    const created = await call('POST', 'songs', { cookie: admin, body: { title: 'Nova', artist: 'Equipe', originalKey: 'G', teamKey: 'A', tags: ['teste'] } })
    expect(created.status).toBe(201)
    const id = created.data.id as string
    const updated = await call('PATCH', `songs/${id}`, { cookie: admin, body: { teamKey: 'Bb' } })
    expect(updated.status).toBe(200)
    expect(updated.data.teamKey).toBe('Bb')
    expect((await call('DELETE', `songs/${id}`, { cookie: admin })).status).toBe(204)
    expect((await call('GET', `songs/${id}`, { cookie: admin })).status).toBe(404)
  })

  it('não expõe detalhes do banco nas mensagens de erro', async () => {
    const res = await call('POST', 'song-videos', { cookie: admin, body: { songId: crypto.randomUUID(), url: 'https://www.youtube.com/watch?v=abc' } })
    expect(res.status).toBe(409)
    expect(res.error?.message).not.toMatch(/violates|constraint|song_videos|sql/i)
  })

  it('rejeita arquivos de tipo não permitido e informa quando o Blob não está configurado', async () => {
    const text = new FormData()
    text.append('file', new File(['olá'], 'nota.txt', { type: 'text/plain' }))
    text.append('kind', 'document')
    expect((await call('POST', 'files', { cookie: admin, form: text })).status).toBe(400)

    const png = new FormData()
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    png.append('file', new File([bytes], 'capa.png', { type: 'image/png' }))
    png.append('kind', 'cover')
    const res = await call('POST', 'files', { cookie: admin, form: png })
    expect(res.status).toBe(503)
  })
})

describe('senhas', () => {
  it('administrador gera senha temporária e as sessões antigas deixam de valer', async () => {
    const res = await call('POST', `users/${memberUserId}/reset-password`, { cookie: admin, body: {} })
    expect(res.status).toBe(200)
    expect(res.data.temporaryPassword).toHaveLength(10)
    expect((await call('GET', 'songs', { cookie: member })).status).toBe(401)
    const login = await call('POST', 'auth/login', { body: { email: 'membro@teste.dev', password: res.data.temporaryPassword } })
    expect(login.status).toBe(200)
    member = login.cookie
  })

  it('integrante não gera senha para outros', async () => {
    const me = (await call('GET', 'auth/session', { cookie: admin })).data.user.id as string
    expect((await call('POST', `users/${me}/reset-password`, { cookie: member, body: {} })).status).toBe(403)
  })

  it('troca de senha exige a senha atual', async () => {
    const wrong = await call('POST', 'auth/password', { cookie: admin, body: { currentPassword: 'errada', newPassword: 'nova-senha-123' } })
    expect(wrong.status).toBe(400)
    const ok = await call('POST', 'auth/password', { cookie: admin, body: { currentPassword: 'senha-segura-1', newPassword: 'nova-senha-123' } })
    expect(ok.status).toBe(204)
  })

  it('logout encerra a sessão', async () => {
    const res = await call('POST', 'auth/logout', { cookie: member })
    expect(res.status).toBe(204)
    expect(res.setCookie).toMatch(/Max-Age=0/)
    expect((await call('GET', 'songs', { cookie: member })).status).toBe(401)
  })
})
