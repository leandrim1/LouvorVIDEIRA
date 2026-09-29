/**
 * Seed de DESENVOLVIMENTO: dados fictícios para testar o sistema.
 *
 *   npm run db:seed            → popula um banco vazio
 *   npm run db:seed -- --reset → apaga TODOS os dados e popula de novo
 *
 * Conteúdo: 15 músicas, 8 integrantes, 5 eventos com repertório, 3 ensaios, 3 escalas e
 * 10 notificações. Nomes, e-mails (@louvorvideira.example) e telefones são fictícios.
 * Nenhum usuário é criado, a não ser o administrador definido em SEED_ADMIN_EMAIL e
 * SEED_ADMIN_PASSWORD. Sem ele, a primeira conta criada no site vira administrador.
 */
import { pathToFileURL } from 'node:url'
import { count } from 'drizzle-orm'
import { SEED_SONGS } from '../data/seed/songs.js'
import { addDays, nextSunday, toISODate } from '../lib/dates.js'
import { lyricsFromSheet } from '../lib/music.js'
import { hashPassword } from '../server/auth.js'
import type { Database } from './index.js'
import * as t from './schema.js'

type MemberRole = (typeof t.memberRole.enumValues)[number]

/** Ordem de exclusão respeitando as foreign keys (filhos antes dos pais) */
const DELETE_ORDER = [
  t.sessions,
  t.files,
  t.notifications,
  t.songPreparations,
  t.rehearsals,
  t.scheduleMembers,
  t.schedules,
  t.repertoireSongs,
  t.repertoires,
  t.events,
  t.songViews,
  t.favorites,
  t.songNotes,
  t.songLinks,
  t.songVideos,
  t.songs,
  t.users,
  t.members,
]

const MEMBERS: { name: string; roles: MemberRole[]; instrument: string; voice: (typeof t.voiceType.enumValues)[number]; notes: string }[] = [
  { name: 'João Mendes', roles: ['leader', 'acoustic_guitar', 'vocal'], instrument: 'Violão', voice: 'tenor', notes: 'Coordenador do ministério de louvor.' },
  { name: 'Maria Oliveira', roles: ['vocal'], instrument: '', voice: 'soprano', notes: 'Prefere tons até C para músicas lentas.' },
  { name: 'Pedro Santos', roles: ['vocal', 'backing_vocal'], instrument: '', voice: 'baritone', notes: '' },
  { name: 'Lucas Almeida', roles: ['electric_guitar'], instrument: 'Guitarra', voice: 'none', notes: 'Responsável pelos timbres.' },
  { name: 'Carlos Ferreira', roles: ['bass'], instrument: 'Baixo', voice: 'none', notes: '' },
  { name: 'Ana Costa', roles: ['keys', 'backing_vocal'], instrument: 'Teclado', voice: 'contralto', notes: 'Cuida dos pads e da ambientação.' },
  { name: 'Rafael Lima', roles: ['drums'], instrument: 'Bateria', voice: 'none', notes: 'Usa click em todos os cultos.' },
  { name: 'Gabriel Rocha', roles: ['sound', 'media'], instrument: 'Mesa de som', voice: 'none', notes: '' },
]

/** Pads de ensaio públicos do YouTube, um por tonalidade */
const PAD_VIDEOS: Record<string, string> = {
  G: '2SveruIMFBM',
  Em: 'NJxJj3XnOoA',
  D: '9CFHZ6jS84M',
  A: 'FO98tWPLwXI',
  C: 'c0bSh8BeT2A',
  E: 'Nj5KSfIiDIE',
  Eb: 'u8aBkgVhH2U',
}

const MAIN_HALL = 'Templo principal (exemplo)'

const emailFor = (name: string) =>
  `${name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.')}@louvorvideira.example`

export interface SeedOptions {
  reset?: boolean
  now?: Date
  admin?: { email: string; password: string; name?: string }
}

export interface SeedSummary {
  [table: string]: number
}

export async function isDatabaseEmpty(db: Database) {
  const totals = await Promise.all(
    [t.members, t.users, t.songs, t.events].map(async (table) => (await db.select({ n: count() }).from(table))[0]?.n ?? 0),
  )
  return totals.every((n) => n === 0)
}

export async function runSeed(db: Database, options: SeedOptions = {}): Promise<SeedSummary> {
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('O seed de desenvolvimento não pode ser executado no ambiente de produção.')
  }
  if (!(await isDatabaseEmpty(db))) {
    if (!options.reset) {
      throw new Error('O banco já possui dados. Para apagar tudo e recriar (somente desenvolvimento), use: npm run db:seed -- --reset')
    }
    for (const table of DELETE_ORDER) await db.delete(table)
  }

  const now = options.now ?? new Date()
  const sunday = nextSunday(now)
  const dateAt = (offset: number) => toISODate(addDays(sunday, offset))
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

  /* Integrantes -------------------------------------------------------- */
  const members = await db
    .insert(t.members)
    .values(
      MEMBERS.map((m, i) => ({
        name: m.name,
        roles: m.roles,
        instrument: m.instrument,
        voice: m.voice,
        phone: `(11) 90000-00${String(i + 1).padStart(2, '0')}`,
        email: emailFor(m.name),
        notes: m.notes,
        createdAt: ago(60 * 24 * 30 - i),
      })),
    )
    .returning()
  const member = (i: number) => members[i]!.id

  /* Administrador opcional ---------------------------------------------- */
  let adminId: string | null = null
  if (options.admin) {
    const [admin] = await db
      .insert(t.users)
      .values({
        name: options.admin.name?.trim() || 'Administrador',
        email: options.admin.email.trim().toLowerCase(),
        passwordHash: await hashPassword(options.admin.password),
        role: 'admin',
        approved: true,
      })
      .returning()
    adminId = admin!.id
  }

  /* Músicas (15) -------------------------------------------------------- */
  const seedSongs = SEED_SONGS.slice(0, 15)
  const songs = await db
    .insert(t.songs)
    .values(
      seedSongs.map((s, i) => ({
        title: s.title,
        artist: s.artist,
        album: s.album,
        composer: s.composer,
        originalKey: s.originalKey,
        teamKey: s.teamKey,
        bpm: s.bpm,
        capo: s.capo,
        tuning: s.tuning,
        timeSignature: s.timeSignature,
        lyrics: lyricsFromSheet(s.chords),
        chords: s.chords,
        notes: s.notes,
        tags: s.tags,
        createdAt: ago(60 * 24 * (40 - i)),
        updatedAt: ago(60 * 24 * (20 - i)),
      })),
    )
    .returning()
  const song = (i: number) => songs[i]!

  const videos = songs.flatMap((s, i) => {
    const pad = PAD_VIDEOS[s.teamKey]
    return pad
      ? [{ songId: s.id, type: 'study' as const, title: `Pad de ensaio em ${s.teamKey}`, url: `https://www.youtube.com/watch?v=${pad}`, createdAt: ago(60 * 24 * 30 - i) }]
      : []
  })
  if (videos.length) await db.insert(t.songVideos).values(videos)

  await db.insert(t.songLinks).values(
    songs.slice(0, 6).flatMap((s, i) => {
      const q = encodeURIComponent(`${s.title} ${s.artist}`)
      return [
        { songId: s.id, type: 'youtube' as const, label: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}`, createdAt: ago(60 * 24 * 30 - i * 2) },
        { songId: s.id, type: 'cifraclub' as const, label: 'Cifra Club', url: `https://www.cifraclub.com.br/?q=${q}`, createdAt: ago(60 * 24 * 30 - i * 2 - 1) },
      ]
    }),
  )

  await db.insert(t.songNotes).values([
    { songId: song(2).id, authorId: member(5), content: 'Começar o refrão uma oitava abaixo e deixar espaço no teclado.', createdAt: ago(60 * 20) },
    { songId: song(2).id, authorId: member(0), content: 'Na ponte, crescer aos poucos, sem acelerar.', createdAt: ago(60 * 30) },
    { songId: song(1).id, authorId: member(6), content: 'Virada de bateria no compasso 8, antes do refrão.', createdAt: ago(60 * 50) },
    { songId: song(0).id, authorId: member(5), content: 'Pad em A durante toda a música.', createdAt: ago(60 * 70) },
  ])

  /* Eventos (5 cultos/eventos + 3 eventos de ensaio) ---------------------- */
  const eventSeeds = [
    { title: 'Culto de Celebração', type: 'service' as const, offset: -14, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Culto de domingo à noite.' },
    { title: 'Culto de Santa Ceia', type: 'communion' as const, offset: -7, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Celebração da Ceia do Senhor.' },
    { title: 'Culto de Celebração', type: 'service' as const, offset: 0, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Ministração sobre gratidão.' },
    { title: 'Culto da Família', type: 'service' as const, offset: 7, start: '10:00', end: '11:45', location: MAIN_HALL, description: 'Culto da manhã com participação das crianças.' },
    { title: 'Vigília de Oração', type: 'vigil' as const, offset: 12, start: '22:00', end: '01:00', location: 'Salão de oração (exemplo)', description: 'Noite de intercessão e adoração.' },
    { title: 'Ensaio geral', type: 'rehearsal' as const, offset: -3, start: '20:00', end: '22:00', location: 'Sala de música (exemplo)', description: '' },
    { title: 'Ensaio geral', type: 'rehearsal' as const, offset: 4, start: '20:00', end: '22:00', location: 'Sala de música (exemplo)', description: '' },
    { title: 'Ensaio da Vigília', type: 'rehearsal' as const, offset: 10, start: '20:00', end: '21:30', location: 'Salão de oração (exemplo)', description: '' },
  ]
  const events = await db
    .insert(t.events)
    .values(
      eventSeeds.map((e, i) => ({
        title: e.title,
        type: e.type,
        date: dateAt(e.offset),
        startTime: e.start,
        endTime: e.end,
        location: e.location,
        description: e.description,
        createdAt: ago(60 * 24 * 25 - i),
      })),
    )
    .returning()
  const event = (i: number) => events[i]!

  /* Repertórios (5) ----------------------------------------------------- */
  const repertoireSeeds = [
    { event: 0, status: 'published' as const, description: 'Tema: a grandeza de Deus.', notes: '', songs: [[4, 0], [1, 1], [2, 1], [3, 0]] },
    { event: 1, status: 'published' as const, description: 'Momento de ceia após a terceira música.', notes: 'Instrumental suave durante a distribuição dos elementos.', songs: [[9, 0], [6, 2], [12, 0], [10, 1]] },
    { event: 2, status: 'published' as const, description: 'Ministração sobre gratidão e fidelidade de Deus.', notes: 'Chegar às 17:30 para a passagem de som.', songs: [[0, 1], [1, 0], [2, 1], [3, 0]] },
    { event: 3, status: 'draft' as const, description: 'Repertório leve, com músicas conhecidas pelas crianças.', notes: 'Confirmar participação do coral infantil.', songs: [[9, 0], [5, 2], [13, 1]] },
    { event: 4, status: 'published' as const, description: 'Adoração intercalada com momentos de oração.', notes: 'Manter pad contínuo entre as músicas.', songs: [[10, 0], [14, 1], [3, 2], [0, 1]] },
  ]
  const repertoires = await db
    .insert(t.repertoires)
    .values(
      repertoireSeeds.map((r, i) => ({
        eventId: event(r.event).id,
        name: event(r.event).title,
        description: r.description,
        notes: r.notes,
        status: r.status,
        createdBy: adminId,
        createdAt: ago(60 * 24 * (10 - i)),
        updatedAt: ago(60 * 24 * (8 - i)),
      })),
    )
    .returning()
  const repertoire = (i: number) => repertoires[i]!

  const repertoireSongs = await db
    .insert(t.repertoireSongs)
    .values(
      repertoireSeeds.flatMap((r, i) =>
        r.songs.map(([songIndex, vocal], position) => ({
          repertoireId: repertoire(i).id,
          songId: song(songIndex!).id,
          position,
          key: song(songIndex!).teamKey,
          leadVocalId: member(vocal!),
          instrumentation: position === r.songs.length - 1 ? 'Acústico' : 'Banda completa',
          notes: '',
        })),
      ),
    )
    .returning()

  /* Preparação de João para o próximo culto ------------------------------ */
  const nextService = repertoireSongs.filter((rs) => rs.repertoireId === repertoire(2).id)
  const checks = [
    [true, true, true, true],
    [true, true, true, false],
    [true, false, false, false],
  ]
  await db.insert(t.songPreparations).values(
    nextService.slice(0, checks.length).map((rs, i) => {
      const [videoWatched, chordsStudied, keyConfirmed, rehearsed] = checks[i]!
      const done = checks[i]!.filter(Boolean).length
      return {
        repertoireSongId: rs.id,
        memberId: member(0),
        videoWatched: videoWatched!,
        chordsStudied: chordsStudied!,
        keyConfirmed: keyConfirmed!,
        rehearsed: rehearsed!,
        status: done === 4 ? ('ready' as const) : ('studying' as const),
        updatedAt: ago(60 * (i + 2)),
      }
    }),
  )

  /* Escalas (3) --------------------------------------------------------- */
  const band: Record<string, number[]> = { electric_guitar: [3], bass: [4], keys: [5], drums: [6], sound: [7], media: [7] }
  const scheduleSeeds: { event: number; notes: string; roles: Record<string, number[]> }[] = [
    { event: 2, notes: 'Todos às 17:30 para a passagem de som.', roles: { leader: [0], vocal: [1, 2], backing_vocal: [5], ...band } },
    { event: 3, notes: 'Escala reduzida, formato acústico.', roles: { leader: [0], vocal: [2], acoustic_guitar: [0], keys: [5], sound: [7] } },
    { event: 4, notes: 'Formato intimista.', roles: { leader: [0], vocal: [1], keys: [5], sound: [7] } },
  ]
  const schedules = await db
    .insert(t.schedules)
    .values(scheduleSeeds.map((s, i) => ({ eventId: event(s.event).id, notes: s.notes, createdAt: ago(60 * 24 * 5 - i) })))
    .returning()
  await db.insert(t.scheduleMembers).values(
    scheduleSeeds.flatMap((s, i) =>
      Object.entries(s.roles).flatMap(([role, list]) =>
        list.map((m) => ({ scheduleId: schedules[i]!.id, memberId: member(m), role: role as MemberRole })),
      ),
    ),
  )

  /* Ensaios (3) --------------------------------------------------------- */
  await db.insert(t.rehearsals).values([
    { eventId: event(5).id, repertoireId: repertoire(2).id, notes: 'Trazer in-ear. Foco na dinâmica.' },
    { eventId: event(6).id, repertoireId: repertoire(3).id, notes: 'Ensaiar as transições com a banda completa.' },
    { eventId: event(7).id, repertoireId: repertoire(4).id, notes: 'Definir os momentos de oração entre as músicas.' },
  ])

  /* Notificações (10, para toda a equipe) ------------------------------- */
  const notificationSeeds = [
    { type: 'repertoire' as const, title: 'Novo repertório', message: `Repertório do ${event(2).title} publicado.`, link: `/repertorios/${repertoire(2).id}`, minutes: 90 },
    { type: 'key_change' as const, title: 'Tom alterado', message: `O tom de "${song(2).title}" foi confirmado em ${song(2).teamKey}.`, link: `/musicas/${song(2).id}`, minutes: 60 * 5 },
    { type: 'rehearsal' as const, title: 'Ensaio agendado', message: `Ensaio geral em ${event(6).date} às ${event(6).startTime}.`, link: '/ensaios', minutes: 60 * 9 },
    { type: 'schedule' as const, title: 'Escala publicada', message: `A escala do ${event(2).title} está disponível.`, link: `/escalas/${schedules[0]!.id}`, minutes: 60 * 26 },
    { type: 'song' as const, title: 'Nova música na biblioteca', message: `A música "${song(14).title}" foi adicionada.`, link: `/musicas/${song(14).id}`, minutes: 60 * 24 * 2 },
    { type: 'repertoire' as const, title: 'Repertório em rascunho', message: `O repertório do ${event(3).title} está sendo montado.`, link: `/repertorios/${repertoire(3).id}`, minutes: 60 * 24 * 3 },
    { type: 'schedule' as const, title: 'Escala publicada', message: `A escala da ${event(4).title} está disponível.`, link: `/escalas/${schedules[2]!.id}`, minutes: 60 * 24 * 4 },
    { type: 'rehearsal' as const, title: 'Ensaio da Vigília', message: `Ensaio da Vigília em ${event(7).date}.`, link: '/ensaios', minutes: 60 * 24 * 5 },
    { type: 'song' as const, title: 'Vídeo de estudo', message: `Novo vídeo de estudo em "${song(0).title}".`, link: `/musicas/${song(0).id}`, minutes: 60 * 24 * 6 },
    { type: 'system' as const, title: 'Bem-vindo(a)', message: 'Dados de exemplo carregados para desenvolvimento.', link: '/', minutes: 60 * 24 * 7 },
  ]
  await db.insert(t.notifications).values(
    notificationSeeds.map((n) => ({ type: n.type, title: n.title, message: n.message, link: n.link, userId: null, createdAt: ago(n.minutes) })),
  )

  /* Favoritos e histórico (apenas quando há um administrador) ------------ */
  if (adminId) {
    await db.insert(t.favorites).values([2, 3, 0].map((i, n) => ({ userId: adminId, songId: song(i).id, createdAt: ago(60 * 24 * (n + 1)) })))
    await db.insert(t.songViews).values([1, 2, 0].map((i, n) => ({ userId: adminId, songId: song(i).id, viewedAt: ago(60 * (n * 7 + 1)) })))
  }

  return {
    members: members.length,
    users: adminId ? 1 : 0,
    songs: songs.length,
    song_videos: videos.length,
    events: events.length,
    repertoires: repertoires.length,
    repertoire_songs: repertoireSongs.length,
    rehearsals: 3,
    schedules: schedules.length,
    notifications: notificationSeeds.length,
  }
}

/* ------------------------------------------------------------------ */
/* CLI: npm run db:seed [-- --reset]                                   */
/* ------------------------------------------------------------------ */

async function main() {
  const { loadLocalEnv } = await import('./env.js')
  loadLocalEnv()
  const reset = process.argv.includes('--reset')
  const email = process.env.SEED_ADMIN_EMAIL?.trim()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && (!password || password.length < 8)) throw new Error('SEED_ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.')
  const admin = email && password ? { email, password, name: process.env.SEED_ADMIN_NAME } : undefined

  let db: Database
  let close = async () => {}
  if (process.env.DATABASE_URL) {
    const { getDb } = await import('./index.js')
    db = getDb()
    console.log('Populando o banco configurado em DATABASE_URL…')
  } else {
    const { openLocalDatabase } = await import('./local.js')
    const local = await openLocalDatabase()
    db = local.db
    close = local.close
    console.log('DATABASE_URL não definida: populando o banco local (.pglite)…')
  }

  try {
    const summary = await runSeed(db, { reset, admin })
    console.table(summary)
    console.log(admin ? `Administrador criado: ${admin.email}` : 'Nenhum usuário criado: a primeira conta criada no site será o administrador.')
  } finally {
    await close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`Erro no seed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
