import { addDays, nextSunday, toISODate, formatWeekday } from '@/lib/dates'
import { lyricsFromSheet } from '@/lib/music'
import type {
  AppNotification,
  ChurchEvent,
  EventType,
  Favorite,
  Member,
  MemberRole,
  PreparationChecklist,
  Rehearsal,
  Repertoire,
  RepertoireSong,
  Schedule,
  ScheduleMember,
  Song,
  SongLink,
  SongNote,
  SongPreparation,
  SongVideo,
  SongView,
  User,
  VoiceType,
} from '@/types'
import { SEED_SONGS } from './songs'

/** Estrutura completa do banco (uma chave por tabela) */
export interface DatabaseState {
  users: User[]
  members: Member[]
  songs: Song[]
  song_videos: SongVideo[]
  song_links: SongLink[]
  song_notes: SongNote[]
  favorites: Favorite[]
  song_views: SongView[]
  events: ChurchEvent[]
  repertoires: Repertoire[]
  repertoire_songs: RepertoireSong[]
  schedules: Schedule[]
  schedule_members: ScheduleMember[]
  rehearsals: Rehearsal[]
  song_preparations: SongPreparation[]
  notifications: AppNotification[]
}

/** IDs determinísticos no formato UUID (compatíveis com o PostgreSQL) */
const sid = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const SEED_IDS = {
  user: (n: number) => sid('c1', n),
  member: (n: number) => sid('b1', n),
  song: (n: number) => sid('a1', n),
  event: (n: number) => sid('d1', n),
  repertoire: (n: number) => sid('e1', n),
  schedule: (n: number) => sid('f1', n),
  rehearsal: (n: number) => sid('a2', n),
}

/** Usuário logado por padrão na demonstração (João — administrador) */
export const DEFAULT_USER_ID = SEED_IDS.user(1)

const PAD_VIDEOS: Record<string, { id: string; title: string }> = {
  G: { id: '2SveruIMFBM', title: 'Pad de ensaio em G' },
  Em: { id: 'NJxJj3XnOoA', title: 'Pad de ensaio em G/Em' },
  D: { id: '9CFHZ6jS84M', title: 'Pad de ensaio em D' },
  A: { id: 'FO98tWPLwXI', title: 'Pad de ensaio em A' },
  C: { id: 'c0bSh8BeT2A', title: 'Pad de ensaio em C' },
  E: { id: 'Nj5KSfIiDIE', title: 'Pad de ensaio em E' },
  Eb: { id: 'u8aBkgVhH2U', title: 'Pad de ensaio em Eb' },
}

interface SeedMember {
  name: string
  roles: MemberRole[]
  instrument: string
  voice: VoiceType
  phone: string
  notes: string
}

const SEED_MEMBERS: SeedMember[] = [
  { name: 'João Mendes', roles: ['leader', 'acoustic_guitar', 'vocal'], instrument: 'Violão', voice: 'tenor', phone: '(11) 98765-1001', notes: 'Coordenador do ministério de louvor.' },
  { name: 'Maria Oliveira', roles: ['vocal'], instrument: '', voice: 'soprano', phone: '(11) 98765-1002', notes: 'Prefere tons até C para músicas lentas.' },
  { name: 'Pedro Santos', roles: ['vocal', 'backing_vocal'], instrument: '', voice: 'baritone', phone: '(11) 98765-1003', notes: '' },
  { name: 'Lucas Almeida', roles: ['electric_guitar'], instrument: 'Guitarra', voice: 'none', phone: '(11) 98765-1004', notes: 'Responsável pelos timbres e pedaleira.' },
  { name: 'Carlos Ferreira', roles: ['bass'], instrument: 'Baixo', voice: 'none', phone: '(11) 98765-1005', notes: '' },
  { name: 'Ana Costa', roles: ['keys', 'backing_vocal'], instrument: 'Teclado', voice: 'contralto', phone: '(11) 98765-1006', notes: 'Cuida dos pads e da ambientação.' },
  { name: 'Rafael Lima', roles: ['drums'], instrument: 'Bateria', voice: 'none', phone: '(11) 98765-1007', notes: 'Usa click em todos os cultos.' },
  { name: 'Gabriel Rocha', roles: ['sound'], instrument: 'Mesa de som', voice: 'none', phone: '(11) 98765-1008', notes: '' },
  { name: 'Daniel Souza', roles: ['media'], instrument: 'Projeção', voice: 'none', phone: '(11) 98765-1009', notes: 'Prepara as letras no telão.' },
  { name: 'Beatriz Nunes', roles: ['leader', 'vocal', 'acoustic_guitar'], instrument: 'Violão', voice: 'contralto', phone: '(11) 98765-1010', notes: 'Líder do culto da manhã.' },
  { name: 'Thiago Martins', roles: ['percussion', 'drums'], instrument: 'Cajón e percussão', voice: 'none', phone: '(11) 98765-1011', notes: '' },
  { name: 'Larissa Gomes', roles: ['backing_vocal', 'vocal'], instrument: '', voice: 'mezzo', phone: '(11) 98765-1012', notes: '' },
]

const emailFor = (name: string) =>
  `${name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.')}@louvorvideira.app`

interface SeedEvent {
  title: string
  type: EventType
  offset: number
  start: string
  end: string | null
  location: string
  description: string
}

interface SeedRepertoireSong {
  song: number
  vocal: number | null
  instrumentation: string
  notes?: string
  key?: string
}

interface SeedRepertoire {
  event: number
  name: string
  status: 'draft' | 'published'
  description: string
  notes: string
  songs: SeedRepertoireSong[]
}

const MAIN_HALL = 'Templo principal — Igreja Videira'

export function createSeed(now = new Date()): DatabaseState {
  const sunday = nextSunday(now)
  const dateAt = (offset: number) => toISODate(addDays(sunday, offset))
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString()
  const stamp = iso(60 * 24 * 30)
  const ts = { createdAt: stamp, updatedAt: stamp }

  /* Integrantes e usuários ------------------------------------------------ */
  const members: Member[] = SEED_MEMBERS.map((m, i) => ({
    id: SEED_IDS.member(i + 1),
    name: m.name,
    photoUrl: null,
    roles: m.roles,
    instrument: m.instrument,
    voice: m.voice,
    phone: m.phone,
    email: emailFor(m.name),
    notes: m.notes,
    active: true,
    ...ts,
  }))
  const memberId = (index: number) => members[index].id

  const userRoles: Record<number, User['role']> = { 0: 'admin', 9: 'leader', 5: 'leader' }
  const users: User[] = members.map((m, i) => ({
    id: SEED_IDS.user(i + 1),
    memberId: m.id,
    name: m.name,
    email: m.email,
    role: userRoles[i] ?? 'member',
    status: 'APPROVED',
    emailVerified: true,
    emailVerifiedAt: stamp,
    approvedAt: stamp,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    approved: true,
    registered: true,
    ...ts,
  }))

  /* Músicas ---------------------------------------------------------------- */
  const songs: Song[] = SEED_SONGS.map((s, i) => ({
    id: SEED_IDS.song(i + 1),
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
    coverUrl: null,
    tags: s.tags,
    createdAt: iso(60 * 24 * (40 - i)),
    updatedAt: iso(60 * 24 * (20 - i)),
  }))
  const songId = (index: number) => songs[index].id

  let videoSeq = 0
  const song_videos: SongVideo[] = songs.flatMap((song) => {
    const pad = PAD_VIDEOS[song.teamKey]
    if (!pad) return []
    videoSeq++
    return [
      {
        id: sid('a3', videoSeq),
        songId: song.id,
        type: 'study' as const,
        title: pad.title,
        url: `https://www.youtube.com/watch?v=${pad.id}`,
        createdAt: stamp,
      },
    ]
  })

  let linkSeq = 0
  const song_links: SongLink[] = songs.slice(0, 6).flatMap((song) => {
    const q = encodeURIComponent(`${song.title} ${song.artist}`)
    const links: Array<Pick<SongLink, 'type' | 'label' | 'url'>> = [
      { type: 'spotify', label: 'Spotify', url: `https://open.spotify.com/search/${q}` },
      { type: 'youtube', label: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
      { type: 'cifraclub', label: 'Cifra Club', url: `https://www.cifraclub.com.br/?q=${q}` },
      { type: 'apple_music', label: 'Apple Music', url: `https://music.apple.com/br/search?term=${q}` },
    ]
    return links.map((link) => ({ ...link, id: sid('a4', ++linkSeq), songId: song.id, createdAt: stamp }))
  })

  const song_notes: SongNote[] = [
    { song: 2, author: 5, text: 'Maria prefere começar o refrão uma oitava abaixo — deixar espaço no teclado.', ago: 60 * 20 },
    { song: 2, author: 0, text: 'Cuidado com a dinâmica na ponte: crescer aos poucos, sem acelerar.', ago: 60 * 30 },
    { song: 1, author: 6, text: 'Virada de bateria no compasso 8, antes do refrão.', ago: 60 * 50 },
    { song: 0, author: 5, text: 'Pad em A durante toda a música. Entrada da banda no 2º refrão.', ago: 60 * 70 },
    { song: 3, author: 0, text: 'Repetir o refrão livremente conforme a ministração.', ago: 60 * 90 },
  ].map((n, i) => ({
    id: sid('a5', i + 1),
    songId: songId(n.song),
    authorId: memberId(n.author),
    content: n.text,
    createdAt: iso(n.ago),
  }))

  /* Eventos ---------------------------------------------------------------- */
  const seedEvents: SeedEvent[] = [
    { title: 'Culto de Celebração', type: 'service', offset: -21, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Culto de domingo à noite.' },
    { title: 'Culto de Celebração', type: 'service', offset: -14, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Culto de domingo à noite.' },
    { title: 'Culto de Santa Ceia', type: 'communion', offset: -7, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Celebração da Ceia do Senhor.' },
    { title: 'Culto de Celebração', type: 'service', offset: 0, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Culto de celebração com ministração sobre gratidão.' },
    { title: 'Culto da Família', type: 'service', offset: 7, start: '10:00', end: '11:45', location: MAIN_HALL, description: 'Culto da manhã com participação das crianças.' },
    { title: 'Culto de Celebração', type: 'service', offset: 7, start: '19:00', end: '21:00', location: MAIN_HALL, description: 'Culto de domingo à noite.' },
    { title: 'Vigília de Oração', type: 'vigil', offset: 12, start: '22:00', end: '01:00', location: 'Salão de oração', description: 'Noite de intercessão e adoração.' },
    { title: 'Conferência Videira 2026', type: 'conference', offset: 20, start: '09:00', end: '18:00', location: 'Centro de Convenções Videira', description: 'Conferência anual com ministrações e workshops para músicos.' },
    { title: 'Noite de Adoração', type: 'special', offset: 26, start: '19:30', end: '22:00', location: MAIN_HALL, description: 'Evento aberto à comunidade, com convidados.' },
    // Ensaios (eventos do tipo "rehearsal")
    { title: 'Ensaio geral', type: 'rehearsal', offset: -10, start: '20:00', end: '22:00', location: 'Sala de música', description: '' },
    { title: 'Ensaio geral', type: 'rehearsal', offset: -3, start: '20:00', end: '22:00', location: 'Sala de música', description: '' },
    { title: 'Passagem de som', type: 'rehearsal', offset: 0, start: '17:30', end: '18:30', location: MAIN_HALL, description: '' },
    { title: 'Ensaio geral', type: 'rehearsal', offset: 4, start: '20:00', end: '22:00', location: 'Sala de música', description: '' },
    { title: 'Ensaio da Vigília', type: 'rehearsal', offset: 10, start: '20:00', end: '21:30', location: 'Salão de oração', description: '' },
  ]
  const events: ChurchEvent[] = seedEvents.map((e, i) => ({
    id: SEED_IDS.event(i + 1),
    title: e.title,
    type: e.type,
    date: dateAt(e.offset),
    startTime: e.start,
    endTime: e.end,
    location: e.location,
    description: e.description,
    ...ts,
  }))
  const eventId = (index: number) => events[index].id

  /* Repertórios ------------------------------------------------------------ */
  const seedRepertoires: SeedRepertoire[] = [
    {
      event: 0, name: 'Culto de Celebração', status: 'published', description: 'Tema: A grandeza de Deus.', notes: '',
      songs: [
        { song: 4, vocal: 0, instrumentation: 'Banda completa' },
        { song: 1, vocal: 1, instrumentation: 'Banda completa' },
        { song: 2, vocal: 1, instrumentation: 'Teclado e pad' },
        { song: 17, vocal: 0, instrumentation: 'Acústico' },
      ],
    },
    {
      event: 1, name: 'Culto de Celebração', status: 'published', description: 'Tema: Fé que atravessa o mar.', notes: '',
      songs: [
        { song: 8, vocal: 9, instrumentation: 'Banda completa' },
        { song: 0, vocal: 1, instrumentation: 'Banda completa' },
        { song: 2, vocal: 1, instrumentation: 'Teclado e pad' },
        { song: 3, vocal: 0, instrumentation: 'Acústico' },
      ],
    },
    {
      event: 2, name: 'Culto de Santa Ceia', status: 'published', description: 'Momento de ceia após a terceira música.', notes: 'Instrumental suave durante a distribuição dos elementos.',
      songs: [
        { song: 9, vocal: 9, instrumentation: 'Banda completa' },
        { song: 6, vocal: 11, instrumentation: 'Acústico' },
        { song: 12, vocal: 0, instrumentation: 'Voz e teclado' },
        { song: 10, vocal: 1, instrumentation: 'Teclado e pad' },
      ],
    },
    {
      event: 3, name: 'Culto de Celebração', status: 'published', description: 'Ministração sobre gratidão e fidelidade de Deus.',
      notes: 'Chegar às 17:30 para a passagem de som. Vestimenta em tons neutros. Ceia não será servida neste culto.',
      songs: [
        { song: 0, vocal: 1, instrumentation: 'Banda completa', notes: 'Começar com teclado e voz.' },
        { song: 1, vocal: 0, instrumentation: 'Banda completa' },
        { song: 2, vocal: 1, instrumentation: 'Teclado e pad', notes: 'Maria no tom de C.' },
        { song: 3, vocal: 0, instrumentation: 'Acústico', notes: 'Ministração livre no final.' },
      ],
    },
    {
      event: 4, name: 'Culto da Família', status: 'draft', description: 'Repertório leve, com músicas conhecidas pelas crianças.', notes: 'Confirmar participação do coral infantil.',
      songs: [
        { song: 16, vocal: 9, instrumentation: 'Banda completa' },
        { song: 9, vocal: 9, instrumentation: 'Acústico' },
        { song: 5, vocal: 11, instrumentation: 'Voz e violão' },
      ],
    },
    {
      event: 5, name: 'Culto de Celebração', status: 'published', description: 'Tema: Nada nos separa do amor de Deus.', notes: '',
      songs: [
        { song: 11, vocal: 11, instrumentation: 'Banda completa' },
        { song: 13, vocal: 9, instrumentation: 'Banda completa' },
        { song: 7, vocal: 1, instrumentation: 'Banda completa' },
        { song: 14, vocal: 9, instrumentation: 'Teclado e pad' },
        { song: 17, vocal: 0, instrumentation: 'Acústico' },
      ],
    },
    {
      event: 6, name: 'Vigília de Oração', status: 'published', description: 'Músicas de adoração intercaladas com momentos de oração.', notes: 'Manter pad contínuo entre as músicas.',
      songs: [
        { song: 10, vocal: 9, instrumentation: 'Teclado e pad' },
        { song: 15, vocal: 0, instrumentation: 'Voz e violão' },
        { song: 3, vocal: 9, instrumentation: 'Teclado e pad' },
        { song: 0, vocal: 11, instrumentation: 'Acústico' },
      ],
    },
  ]

  const repertoires: Repertoire[] = []
  const repertoire_songs: RepertoireSong[] = []
  let rsSeq = 0
  seedRepertoires.forEach((r, i) => {
    const id = SEED_IDS.repertoire(i + 1)
    repertoires.push({
      id,
      eventId: eventId(r.event),
      name: r.name,
      description: r.description,
      notes: r.notes,
      status: r.status,
      createdBy: users[0].id,
      createdAt: iso(60 * 24 * (10 - i)),
      updatedAt: iso(60 * 24 * (8 - i)),
    })
    r.songs.forEach((s, position) => {
      repertoire_songs.push({
        id: sid('e2', ++rsSeq),
        repertoireId: id,
        songId: songId(s.song),
        position,
        key: s.key ?? songs[s.song].teamKey,
        leadVocalId: s.vocal !== null ? memberId(s.vocal) : null,
        instrumentation: s.instrumentation,
        notes: s.notes ?? '',
      })
    })
  })

  /* Escalas ---------------------------------------------------------------- */
  const fullBand = (leader: number, vocals: number[], extra: Partial<Record<MemberRole, number[]>> = {}) => ({
    leader: [leader],
    vocal: vocals,
    electric_guitar: [3],
    bass: [4],
    keys: [5],
    drums: [6],
    sound: [7],
    media: [8],
    ...extra,
  })
  const seedSchedules: Array<{ event: number; notes: string; roles: Partial<Record<MemberRole, number[]>> }> = [
    { event: 0, notes: '', roles: fullBand(0, [1, 2]) },
    { event: 1, notes: '', roles: fullBand(9, [1, 11], { drums: [10] }) },
    { event: 2, notes: '', roles: fullBand(0, [9, 11]) },
    { event: 3, notes: 'Todos às 17:30 para a passagem de som.', roles: fullBand(0, [1, 2], { backing_vocal: [11] }) },
    { event: 4, notes: 'Escala reduzida — formato acústico.', roles: { leader: [9], vocal: [11], acoustic_guitar: [0], keys: [5], percussion: [10], sound: [7] } },
    { event: 5, notes: '', roles: fullBand(9, [11, 1], { acoustic_guitar: [0], drums: [10] }) },
    { event: 6, notes: 'Formato intimista.', roles: { leader: [9], acoustic_guitar: [0], keys: [5], sound: [7] } },
  ]
  const schedules: Schedule[] = []
  const schedule_members: ScheduleMember[] = []
  let smSeq = 0
  seedSchedules.forEach((s, i) => {
    const id = SEED_IDS.schedule(i + 1)
    schedules.push({ id, eventId: eventId(s.event), notes: s.notes, ...ts })
    for (const [role, list] of Object.entries(s.roles) as Array<[MemberRole, number[]]>) {
      for (const m of list) {
        schedule_members.push({ id: sid('f2', ++smSeq), scheduleId: id, memberId: memberId(m), role })
      }
    }
  })

  /* Ensaios ---------------------------------------------------------------- */
  const seedRehearsals = [
    { event: 9, repertoire: 2, notes: 'Repassar transições da ceia.' },
    { event: 10, repertoire: 3, notes: 'Trazer in-ear. Foco na dinâmica de "Oceanos".' },
    { event: 11, repertoire: 3, notes: 'Passagem de som e checagem de retornos.' },
    { event: 12, repertoire: 5, notes: 'Ensaiar "Nada Vai Me Separar" com a banda completa.' },
    { event: 13, repertoire: 6, notes: 'Definir momentos de oração entre as músicas.' },
  ]
  const rehearsals: Rehearsal[] = seedRehearsals.map((r, i) => ({
    id: SEED_IDS.rehearsal(i + 1),
    eventId: eventId(r.event),
    repertoireId: SEED_IDS.repertoire(r.repertoire + 1),
    notes: r.notes,
    ...ts,
  }))

  /* Preparação (João no próximo culto, Beatriz no seguinte) ----------------- */
  const prep = (checks: PreparationChecklist) => {
    const done = Object.values(checks).filter(Boolean).length
    return { ...checks, status: done === 4 ? 'ready' : done === 0 ? 'not_studied' : 'studying' } as const
  }
  const nextServiceSongs = repertoire_songs.filter((rs) => rs.repertoireId === SEED_IDS.repertoire(4))
  const checklists: PreparationChecklist[] = [
    { videoWatched: true, chordsStudied: true, keyConfirmed: true, rehearsed: true },
    { videoWatched: true, chordsStudied: true, keyConfirmed: true, rehearsed: true },
    { videoWatched: true, chordsStudied: true, keyConfirmed: true, rehearsed: false },
    { videoWatched: true, chordsStudied: false, keyConfirmed: false, rehearsed: false },
  ]
  let prepSeq = 0
  const song_preparations: SongPreparation[] = nextServiceSongs.map((rs, i) => ({
    id: sid('b2', ++prepSeq),
    repertoireSongId: rs.id,
    memberId: memberId(0),
    ...prep(checklists[i] ?? checklists[3]),
    updatedAt: iso(60 * (i + 2)),
  }))
  for (const rs of repertoire_songs.filter((r) => r.repertoireId === SEED_IDS.repertoire(6)).slice(0, 2)) {
    song_preparations.push({
      id: sid('b2', ++prepSeq),
      repertoireSongId: rs.id,
      memberId: memberId(9),
      ...prep({ videoWatched: true, chordsStudied: true, keyConfirmed: false, rehearsed: false }),
      updatedAt: iso(60 * 5),
    })
  }

  /* Favoritos e histórico --------------------------------------------------- */
  const userId = users[0].id
  const favorites: Favorite[] = [2, 3, 0, 10].map((s, i) => ({
    id: sid('c3', i + 1),
    userId,
    songId: songId(s),
    createdAt: iso(60 * 24 * (i + 1)),
  }))
  const song_views: SongView[] = [1, 2, 0, 3, 13].map((s, i) => ({
    id: sid('c4', i + 1),
    userId,
    songId: songId(s),
    viewedAt: iso(60 * (i * 7 + 1)),
  }))

  /* Notificações ------------------------------------------------------------ */
  const nextRehearsal = events[10]
  const nextSchedule = schedules[3]
  const notifications: AppNotification[] = [
    {
      type: 'repertoire' as const,
      title: 'Novo repertório',
      message: `Novo repertório adicionado para ${formatWeekday(events[3].date).toLowerCase()}.`,
      link: `/repertorios/${SEED_IDS.repertoire(4)}`,
      ago: 90,
      read: false,
      user: null,
    },
    {
      type: 'key_change' as const,
      title: 'Tom alterado',
      message: `O tom de "Oceanos" foi alterado para C.`,
      link: `/musicas/${songId(2)}`,
      ago: 60 * 5,
      read: false,
      user: null,
    },
    {
      type: 'rehearsal' as const,
      title: 'Ensaio agendado',
      message: `Ensaio ${formatWeekday(nextRehearsal.date).toLowerCase()} às ${nextRehearsal.startTime}.`,
      link: '/ensaios',
      ago: 60 * 9,
      read: false,
      user: null,
    },
    {
      type: 'schedule' as const,
      title: 'Você foi escalado',
      message: `Você foi escalado para ${formatWeekday(events[3].date).toLowerCase()}.`,
      link: `/escalas/${nextSchedule.id}`,
      ago: 60 * 26,
      read: false,
      user: userId,
    },
    {
      type: 'song' as const,
      title: 'Nova música na biblioteca',
      message: 'A música "Luz do Mundo" foi adicionada à biblioteca.',
      link: `/musicas/${songId(16)}`,
      ago: 60 * 24 * 3,
      read: true,
      user: null,
    },
    {
      type: 'repertoire' as const,
      title: 'Repertório publicado',
      message: 'O repertório da Vigília de Oração foi publicado.',
      link: `/repertorios/${SEED_IDS.repertoire(7)}`,
      ago: 60 * 24 * 4,
      read: true,
      user: null,
    },
  ].map((n, i) => ({
    id: sid('c2', i + 1),
    userId: n.user,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    readBy: n.read ? [userId] : [],
    createdAt: iso(n.ago),
  }))

  return {
    users,
    members,
    songs,
    song_videos,
    song_links,
    song_notes,
    favorites,
    song_views,
    events,
    repertoires,
    repertoire_songs,
    schedules,
    schedule_members,
    rehearsals,
    song_preparations,
    notifications,
  }
}
