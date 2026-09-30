/**
 * Schema do banco (PostgreSQL / Neon) — fonte única dos tipos de dados.
 * Os tipos usados pelo frontend (src/types) são derivados daqui.
 *
 * Convenções: colunas em snake_case no banco, camelCase no TypeScript;
 * IDs UUID; exclusões em cascata onde o registro filho não faz sentido sozinho.
 */
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum('user_role', ['admin', 'leader', 'member'])
/**
 * Ciclo da conta: cadastro → confirmação do e-mail → aprovação do administrador → acesso.
 * Só contas APPROVED com e-mail verificado entram no sistema.
 */
export const userStatus = pgEnum('user_status', [
  'PENDING_EMAIL_VERIFICATION',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
])
export const memberRole = pgEnum('member_role', [
  'leader',
  'vocal',
  'backing_vocal',
  'acoustic_guitar',
  'electric_guitar',
  'bass',
  'keys',
  'drums',
  'percussion',
  'sound',
  'media',
  'other',
])
export const voiceType = pgEnum('voice_type', ['soprano', 'mezzo', 'contralto', 'tenor', 'baritone', 'bass', 'none'])
export const eventType = pgEnum('event_type', ['service', 'rehearsal', 'special', 'conference', 'vigil', 'communion', 'other'])
export const repertoireStatus = pgEnum('repertoire_status', ['draft', 'published'])
export const preparationStatus = pgEnum('preparation_status', ['not_studied', 'studying', 'ready'])
export const songVideoType = pgEnum('song_video_type', ['official', 'study', 'rehearsal', 'live', 'other'])
export const songLinkType = pgEnum('song_link_type', ['youtube', 'spotify', 'apple_music', 'cifraclub', 'deezer', 'other'])
export const notificationType = pgEnum('notification_type', ['repertoire', 'key_change', 'rehearsal', 'schedule', 'song', 'system'])
export const fileKind = pgEnum('file_kind', ['cover', 'photo', 'document', 'audio', 'other'])

/* ------------------------------------------------------------------ */
/* Tipos de coluna                                                     */
/* ------------------------------------------------------------------ */

/** Horário sem segundos: grava como `time`, devolve "HH:mm" */
const timeOfDay = customType<{ data: string; driverData: string }>({
  dataType: () => 'time',
  fromDriver: (value) => value.slice(0, 5),
})

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

/* ------------------------------------------------------------------ */
/* Integrantes, usuários e sessões                                     */
/* ------------------------------------------------------------------ */

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  photoUrl: text('photo_url'),
  roles: memberRole('roles').array().notNull().default(sql`'{}'`),
  instrument: text('instrument').notNull().default(''),
  voice: voiceType('voice').notNull().default('none'),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  notes: text('notes').notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    /** Hash scrypt. Nulo = convite criado pelo administrador, conta ainda não ativada */
    passwordHash: text('password_hash'),
    role: userRole('role').notNull().default('member'),
    status: userStatus('status').notNull().default('PENDING_EMAIL_VERIFICATION'),
    /** Verdadeiro somente depois que a pessoa abre o link enviado para o endereço */
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** SHA-256 do token do link de confirmação (o token em si só existe no e-mail) */
    emailVerificationTokenHash: text('email_verification_token_hash').unique(),
    emailVerificationExpiresAt: timestamp('email_verification_expires_at', { withTimezone: true }),
    /** Último envio do e-mail de confirmação (intervalo mínimo entre reenvios) */
    emailVerificationSentAt: timestamp('email_verification_sent_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
    index('users_member_idx').on(t.memberId),
    index('users_status_idx').on(t.status),
  ],
)

/** Limite de tentativas (login, cadastro, envio de e-mails): uma janela de contagem por chave */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Código de acesso (OTP) do login em duas etapas. O código de 6 dígitos só existe no e-mail:
 * o banco guarda o hash de (desafio + código), onde o desafio é um segredo de 256 bits
 * guardado em cookie httpOnly no navegador que digitou a senha.
 */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 do token de desafio (cookie) que liga o código a quem acertou a senha */
    challengeHash: text('challenge_hash').notNull().unique(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: smallint('attempts').notNull().default(0),
    usedAt: timestamp('used_at', { withTimezone: true }),
    /** Último envio do código (intervalo mínimo entre reenvios) */
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    requestedIp: text('requested_ip').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
  },
  (t) => [index('otp_codes_user_idx').on(t.userId, t.createdAt)],
)

/**
 * Dispositivo confiável: permite pular o código nos próximos logins (não é a sessão).
 * O token fica em cookie httpOnly; o banco guarda só o hash, trocado a cada uso.
 */
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    /** Hash do token anterior: se reaparecer, o cookie pode ter sido copiado */
    previousTokenHash: text('previous_token_hash'),
    deviceName: text('device_name').notNull().default(''),
    browser: text('browser').notNull().default(''),
    os: text('os').notNull().default(''),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastIp: text('last_ip').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
  },
  (t) => [index('device_tokens_user_idx').on(t.userId), index('device_tokens_previous_idx').on(t.previousTokenHash)],
)

/** Registro de eventos de segurança (login, códigos, dispositivos) */
export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    ip: text('ip').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('security_events_user_idx').on(t.userId, t.createdAt), index('security_events_type_idx').on(t.type, t.createdAt)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 do token do cookie (o token em si nunca é gravado) */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/* ------------------------------------------------------------------ */
/* Músicas                                                             */
/* ------------------------------------------------------------------ */

export const songs = pgTable(
  'songs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    album: text('album').notNull().default(''),
    composer: text('composer').notNull().default(''),
    originalKey: text('original_key').notNull(),
    teamKey: text('team_key').notNull(),
    bpm: smallint('bpm'),
    capo: smallint('capo'),
    tuning: text('tuning').notNull().default(''),
    timeSignature: text('time_signature').notNull().default('4/4'),
    lyrics: text('lyrics').notNull().default(''),
    chords: text('chords').notNull().default(''),
    notes: text('notes').notNull().default(''),
    coverUrl: text('cover_url'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('songs_bpm_range', sql`${t.bpm} is null or ${t.bpm} between 30 and 300`),
    check('songs_capo_range', sql`${t.capo} is null or ${t.capo} between 0 and 12`),
    index('songs_title_idx').on(t.title),
  ],
)

export const songVideos = pgTable(
  'song_videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    type: songVideoType('type').notNull().default('other'),
    title: text('title').notNull().default(''),
    url: text('url').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('song_videos_song_idx').on(t.songId)],
)

export const songLinks = pgTable(
  'song_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    type: songLinkType('type').notNull().default('other'),
    label: text('label').notNull().default(''),
    url: text('url').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('song_links_song_idx').on(t.songId)],
)

export const songNotes = pgTable(
  'song_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => members.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('song_notes_song_idx').on(t.songId)],
)

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [unique('favorites_user_song_unique').on(t.userId, t.songId)],
)

/** Histórico "recentemente acessadas" */
export const songViews = pgTable(
  'song_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('song_views_user_idx').on(t.userId, t.viewedAt)],
)

/* ------------------------------------------------------------------ */
/* Eventos, repertórios, escalas e ensaios                             */
/* ------------------------------------------------------------------ */

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    type: eventType('type').notNull().default('service'),
    date: date('date', { mode: 'string' }).notNull(),
    startTime: timeOfDay('start_time').notNull(),
    endTime: timeOfDay('end_time'),
    location: text('location').notNull().default(''),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('events_date_idx').on(t.date, t.startTime)],
)

export const repertoires = pgTable('repertoires', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Um repertório por evento */
  eventId: uuid('event_id')
    .notNull()
    .unique()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  notes: text('notes').notNull().default(''),
  status: repertoireStatus('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const repertoireSongs = pgTable(
  'repertoire_songs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repertoireId: uuid('repertoire_id')
      .notNull()
      .references(() => repertoires.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull().default(0),
    key: text('key').notNull(),
    leadVocalId: uuid('lead_vocal_id').references(() => members.id, { onDelete: 'set null' }),
    instrumentation: text('instrumentation').notNull().default(''),
    notes: text('notes').notNull().default(''),
  },
  (t) => [index('repertoire_songs_repertoire_idx').on(t.repertoireId, t.position), index('repertoire_songs_song_idx').on(t.songId)],
)

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Uma escala por evento */
  eventId: uuid('event_id')
    .notNull()
    .unique()
    .references(() => events.id, { onDelete: 'cascade' }),
  notes: text('notes').notNull().default(''),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const scheduleMembers = pgTable(
  'schedule_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull(),
  },
  (t) => [unique('schedule_members_unique').on(t.scheduleId, t.memberId, t.role), index('schedule_members_member_idx').on(t.memberId)],
)

/** Ensaio = evento do tipo "rehearsal" + repertório a ensaiar */
export const rehearsals = pgTable(
  'rehearsals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .unique()
      .references(() => events.id, { onDelete: 'cascade' }),
    repertoireId: uuid('repertoire_id').references(() => repertoires.id, { onDelete: 'set null' }),
    notes: text('notes').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('rehearsals_repertoire_idx').on(t.repertoireId)],
)

/** Preparação individual de cada integrante por música do repertório */
export const songPreparations = pgTable(
  'song_preparations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repertoireSongId: uuid('repertoire_song_id')
      .notNull()
      .references(() => repertoireSongs.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    videoWatched: boolean('video_watched').notNull().default(false),
    chordsStudied: boolean('chords_studied').notNull().default(false),
    keyConfirmed: boolean('key_confirmed').notNull().default(false),
    rehearsed: boolean('rehearsed').notNull().default(false),
    status: preparationStatus('status').notNull().default('not_studied'),
    updatedAt: updatedAt(),
  },
  (t) => [unique('song_preparations_unique').on(t.repertoireSongId, t.memberId), index('song_preparations_member_idx').on(t.memberId)],
)

/* ------------------------------------------------------------------ */
/* Notificações e arquivos                                             */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Nulo = notificação para toda a equipe */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull().default('system'),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    readBy: uuid('read_by').array().notNull().default(sql`'{}'`),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
)

/** Metadados de arquivos guardados no Vercel Blob (o binário nunca vai para o banco) */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Nome original do arquivo (apenas para exibição) */
    name: text('name').notNull().default(''),
    url: text('url').notNull(),
    pathname: text('pathname').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    kind: fileKind('kind').notNull().default('other'),
    songId: uuid('song_id').references(() => songs.id, { onDelete: 'set null' }),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('files_song_idx').on(t.songId), index('files_member_idx').on(t.memberId)],
)

/* ------------------------------------------------------------------ */
/* Relacionamentos (consultas relacionais do Drizzle)                  */
/* ------------------------------------------------------------------ */

export const membersRelations = relations(members, ({ many }) => ({
  users: many(users),
  scheduleMembers: many(scheduleMembers),
  songNotes: many(songNotes),
  preparations: many(songPreparations),
  files: many(files),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  member: one(members, { fields: [users.memberId], references: [members.id] }),
  sessions: many(sessions),
  favorites: many(favorites),
  songViews: many(songViews),
  notifications: many(notifications),
  repertoires: many(repertoires),
  files: many(files),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const songsRelations = relations(songs, ({ many }) => ({
  videos: many(songVideos),
  links: many(songLinks),
  notes: many(songNotes),
  favorites: many(favorites),
  views: many(songViews),
  repertoireSongs: many(repertoireSongs),
  files: many(files),
}))

export const songVideosRelations = relations(songVideos, ({ one }) => ({
  song: one(songs, { fields: [songVideos.songId], references: [songs.id] }),
}))

export const songLinksRelations = relations(songLinks, ({ one }) => ({
  song: one(songs, { fields: [songLinks.songId], references: [songs.id] }),
}))

export const songNotesRelations = relations(songNotes, ({ one }) => ({
  song: one(songs, { fields: [songNotes.songId], references: [songs.id] }),
  author: one(members, { fields: [songNotes.authorId], references: [members.id] }),
}))

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  song: one(songs, { fields: [favorites.songId], references: [songs.id] }),
}))

export const songViewsRelations = relations(songViews, ({ one }) => ({
  user: one(users, { fields: [songViews.userId], references: [users.id] }),
  song: one(songs, { fields: [songViews.songId], references: [songs.id] }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  repertoire: one(repertoires),
  schedule: one(schedules),
  rehearsal: one(rehearsals),
}))

export const repertoiresRelations = relations(repertoires, ({ one, many }) => ({
  event: one(events, { fields: [repertoires.eventId], references: [events.id] }),
  createdByUser: one(users, { fields: [repertoires.createdBy], references: [users.id] }),
  songs: many(repertoireSongs),
  rehearsals: many(rehearsals),
}))

export const repertoireSongsRelations = relations(repertoireSongs, ({ one, many }) => ({
  repertoire: one(repertoires, { fields: [repertoireSongs.repertoireId], references: [repertoires.id] }),
  song: one(songs, { fields: [repertoireSongs.songId], references: [songs.id] }),
  leadVocal: one(members, { fields: [repertoireSongs.leadVocalId], references: [members.id] }),
  preparations: many(songPreparations),
}))

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  event: one(events, { fields: [schedules.eventId], references: [events.id] }),
  members: many(scheduleMembers),
}))

export const scheduleMembersRelations = relations(scheduleMembers, ({ one }) => ({
  schedule: one(schedules, { fields: [scheduleMembers.scheduleId], references: [schedules.id] }),
  member: one(members, { fields: [scheduleMembers.memberId], references: [members.id] }),
}))

export const rehearsalsRelations = relations(rehearsals, ({ one }) => ({
  event: one(events, { fields: [rehearsals.eventId], references: [events.id] }),
  repertoire: one(repertoires, { fields: [rehearsals.repertoireId], references: [repertoires.id] }),
}))

export const songPreparationsRelations = relations(songPreparations, ({ one }) => ({
  repertoireSong: one(repertoireSongs, { fields: [songPreparations.repertoireSongId], references: [repertoireSongs.id] }),
  member: one(members, { fields: [songPreparations.memberId], references: [members.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))

export const filesRelations = relations(files, ({ one }) => ({
  song: one(songs, { fields: [files.songId], references: [songs.id] }),
  member: one(members, { fields: [files.memberId], references: [members.id] }),
  uploader: one(users, { fields: [files.uploadedBy], references: [users.id] }),
}))
