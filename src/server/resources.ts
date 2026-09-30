/**
 * Recursos REST expostos em /api/<recurso>.
 * Cada recurso define: validação (Zod, derivada do schema Drizzle), quem pode escrever,
 * quais linhas cada usuário enxerga e regras extras de segurança. Tudo verificado no servidor.
 */
import { and, count, eq, isNull, or, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import * as t from '../db/schema.js'
import { hasPermission, type Permission } from '../lib/permissions.js'
import { afterEmailChange } from './accounts.js'
import { publicUser, type Session, type UserRow } from './auth.js'
import { isValidEmailFormat } from './emailValidation.js'
import { ApiError } from './http.js'

export interface ResourceContext {
  db: Database
  session: Session
}

export type Operation = 'insert' | 'update' | 'delete'
export type DbRow = Record<string, unknown>

export interface Resource {
  table: PgTable
  id: PgColumn
  insertSchema: z.ZodType<DbRow>
  updateSchema: z.ZodType<DbRow>
  /** Colunas que o servidor preenche (data de criação/alteração) */
  managed: { createdAt?: PgColumn; updatedAt?: PgColumn; viewedAt?: PgColumn }
  canWrite: (ctx: ResourceContext, op: Operation) => boolean
  /** Restrição de linhas visíveis/alteráveis para o usuário (ex.: favoritos próprios) */
  scope?: (ctx: ResourceContext) => SQL | undefined
  prepareInsert?: (ctx: ResourceContext, row: DbRow) => DbRow | Promise<DbRow>
  guardUpdate?: (ctx: ResourceContext, existing: DbRow, patch: DbRow) => DbRow | Promise<DbRow>
  /** Depois de salvar (ex.: enviar a confirmação do novo e-mail) */
  afterUpdate?: (ctx: ResourceContext, row: DbRow, existing: DbRow) => Promise<void>
  guardDelete?: (ctx: ResourceContext, existing: DbRow) => void | Promise<void>
  serialize?: (row: DbRow) => unknown
  /** Permite DELETE /api/<recurso>?filtro=… (exclusão em lote) */
  bulkDelete?: boolean
  /** Colunas que não podem ser usadas como filtro */
  privateColumns?: string[]
}

/* ------------------------------------------------------------------ */
/* Validações comuns                                                   */
/* ------------------------------------------------------------------ */

const text = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres`)
const required = (max: number) => text(max).min(1, 'Campo obrigatório')
const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), 'Informe uma URL começando com http:// ou https://')
const musicalKey = z.string().trim().regex(/^[A-G](#|b)?m?$/, 'Tom inválido (ex.: G, F#, Bb, Em)')
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Horário inválido')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
const optionalEmail = z.union([z.literal(''), z.email('E-mail inválido')])
const internalLink = z
  .string()
  .max(500)
  .refine((v) => v.startsWith('/') && !v.startsWith('//'), 'Link interno inválido')

/**
 * Schemas Zod derivados das tabelas (drizzle-zod). Os refinamentos são passados como função
 * para o drizzle-zod manter a obrigatoriedade de cada coluna: campos com valor padrão ou
 * nulos continuam opcionais na criação, e todos são opcionais na alteração.
 * A tipagem é simplificada (a inferência completa estoura o limite do TypeScript);
 * as chaves dos refinamentos continuam verificadas contra as colunas da tabela.
 */
type LooseObject = z.ZodObject<Record<string, z.ZodType>>
type Refinements<T extends PgTable> = Partial<Record<Extract<keyof T['_']['columns'], string>, z.ZodType>>
type SchemaFactory = (table: PgTable, refine?: Record<string, (schema: z.ZodType) => z.ZodType>) => LooseObject

const asFunctions = (refinements: Record<string, z.ZodType | undefined>) =>
  Object.fromEntries(Object.entries(refinements).map(([key, schema]) => [key, () => schema as z.ZodType]))

const insertOf = <T extends PgTable>(table: T, refinements: Refinements<T> = {}) =>
  (createInsertSchema as unknown as SchemaFactory)(table, asFunctions(refinements))
const updateOf = <T extends PgTable>(table: T, refinements: Refinements<T> = {}) =>
  (createUpdateSchema as unknown as SchemaFactory)(table, asFunctions(refinements))

const can = (ctx: ResourceContext, ...permissions: Permission[]) =>
  permissions.some((p) => hasPermission(ctx.session.user.role, p))

const myMemberId = (ctx: ResourceContext) => ctx.session.user.memberId

/* ------------------------------------------------------------------ */
/* Regras de usuários                                                  */
/* ------------------------------------------------------------------ */

async function approvedAdminCount(db: Database): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(t.users)
    .where(and(eq(t.users.role, 'admin'), eq(t.users.status, 'APPROVED')))
  return row?.total ?? 0
}

async function ensureAnotherAdmin(db: Database, user: DbRow) {
  if (user.role === 'admin' && user.status === 'APPROVED' && (await approvedAdminCount(db)) <= 1) {
    throw ApiError.conflict('É necessário manter pelo menos um administrador com acesso.')
  }
}

/* ------------------------------------------------------------------ */
/* Recursos                                                            */
/* ------------------------------------------------------------------ */

const members: Resource = {
  table: t.members,
  id: t.members.id,
  insertSchema: insertOf(t.members, {
    name: required(120),
    photoUrl: httpUrl,
    instrument: text(80),
    phone: text(40),
    email: optionalEmail,
    notes: text(2000),
  }).omit({ createdAt: true, updatedAt: true }),
  updateSchema: updateOf(t.members, {
    name: required(120),
    photoUrl: httpUrl,
    instrument: text(80),
    phone: text(40),
    email: optionalEmail,
    notes: text(2000),
  }).omit({ id: true, createdAt: true, updatedAt: true }),
  managed: { createdAt: t.members.createdAt, updatedAt: t.members.updatedAt },
  canWrite: (ctx) => can(ctx, 'members:write'),
}

/**
 * Campos da conta que só mudam pelos fluxos próprios (cadastro, confirmação do e-mail,
 * aprovação, recusa, suspensão) e nunca por uma edição comum enviada pelo navegador.
 */
const ACCOUNT_FIELDS = {
  passwordHash: true,
  status: true,
  emailVerified: true,
  emailVerifiedAt: true,
  emailVerificationTokenHash: true,
  emailVerificationExpiresAt: true,
  emailVerificationSentAt: true,
  approvedAt: true,
  approvedBy: true,
  rejectedAt: true,
  rejectedBy: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} as const

const userEmail = z
  .string()
  .trim()
  .max(254)
  .refine(isValidEmailFormat, 'E-mail inválido')
  .transform((v) => v.toLowerCase())

const users: Resource = {
  table: t.users,
  id: t.users.id,
  // Convite: nasce sem senha e sem e-mail confirmado; a pessoa cria a conta e confirma o endereço
  insertSchema: insertOf(t.users, { name: required(120), email: userEmail }).omit(ACCOUNT_FIELDS),
  updateSchema: updateOf(t.users, { name: required(120), email: userEmail }).omit({ id: true, ...ACCOUNT_FIELDS }),
  managed: { createdAt: t.users.createdAt, updatedAt: t.users.updatedAt },
  privateColumns: ['passwordHash', 'emailVerificationTokenHash', 'emailVerificationExpiresAt', 'emailVerificationSentAt'],
  canWrite: (ctx, op) => (op === 'update' ? can(ctx, 'users:manage', 'members:write') : can(ctx, 'users:manage')),
  // Integrantes e líderes veem só as contas ativas; solicitações pendentes ficam para o administrador
  scope: (ctx) => (can(ctx, 'users:manage') ? undefined : eq(t.users.status, 'APPROVED')),
  serialize: (row) => publicUser(row as UserRow),
  guardUpdate: async (ctx, existing, patch) => {
    if (!can(ctx, 'users:manage')) {
      // Líderes só sincronizam o nome ou desfazem o vínculo com um integrante removido
      const allowed = Object.entries(patch).every(([key, value]) => key === 'name' || (key === 'memberId' && value === null))
      if (!allowed) throw ApiError.forbidden('Apenas administradores alteram níveis de acesso.')
      return patch
    }
    if (patch.role !== undefined && patch.role !== 'admin') await ensureAnotherAdmin(ctx.db, existing)
    // E-mail alterado: o novo endereço precisa ser confirmado outra vez
    if (typeof patch.email === 'string' && patch.email !== String(existing.email).toLowerCase()) {
      if (existing.id === ctx.session.user.id) throw ApiError.forbidden('Você não pode alterar o próprio e-mail por aqui.')
      return {
        ...patch,
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
        ...(existing.status === 'PENDING_ADMIN_APPROVAL' ? { status: 'PENDING_EMAIL_VERIFICATION' } : {}),
      }
    }
    return patch
  },
  afterUpdate: async (ctx, row, existing) => {
    if (row.email !== existing.email) await afterEmailChange(ctx.db, row as UserRow)
  },
  guardDelete: async (ctx, existing) => {
    if (existing.id === ctx.session.user.id) throw ApiError.forbidden('Você não pode remover o próprio acesso.')
    await ensureAnotherAdmin(ctx.db, existing)
  },
}

const songRefinements = {
  title: required(200),
  artist: required(200),
  album: text(200),
  composer: text(200),
  originalKey: musicalKey,
  teamKey: musicalKey,
  bpm: z.number().int().min(30).max(300),
  capo: z.number().int().min(0).max(12),
  tuning: text(80),
  timeSignature: text(10),
  lyrics: text(50_000),
  chords: text(50_000),
  notes: text(5000),
  coverUrl: httpUrl,
  tags: z.array(text(40)).max(20),
}

const songs: Resource = {
  table: t.songs,
  id: t.songs.id,
  insertSchema: insertOf(t.songs, songRefinements).omit({ createdAt: true, updatedAt: true }),
  updateSchema: updateOf(t.songs, songRefinements).omit({ id: true, createdAt: true, updatedAt: true }),
  managed: { createdAt: t.songs.createdAt, updatedAt: t.songs.updatedAt },
  canWrite: (ctx, op) => can(ctx, op === 'delete' ? 'songs:delete' : 'songs:write'),
}

const songVideos: Resource = {
  table: t.songVideos,
  id: t.songVideos.id,
  insertSchema: insertOf(t.songVideos, { title: text(200), url: httpUrl }).omit({ createdAt: true }),
  updateSchema: updateOf(t.songVideos, { title: text(200), url: httpUrl }).omit({ id: true, createdAt: true }),
  managed: { createdAt: t.songVideos.createdAt },
  canWrite: (ctx) => can(ctx, 'songs:write'),
  bulkDelete: true,
}

const songLinks: Resource = {
  table: t.songLinks,
  id: t.songLinks.id,
  insertSchema: insertOf(t.songLinks, { label: text(120), url: httpUrl }).omit({ createdAt: true }),
  updateSchema: updateOf(t.songLinks, { label: text(120), url: httpUrl }).omit({ id: true, createdAt: true }),
  managed: { createdAt: t.songLinks.createdAt },
  canWrite: (ctx) => can(ctx, 'songs:write'),
  bulkDelete: true,
}

const songNotes: Resource = {
  table: t.songNotes,
  id: t.songNotes.id,
  insertSchema: insertOf(t.songNotes, { content: required(2000) }).omit({ createdAt: true }),
  updateSchema: updateOf(t.songNotes, { content: required(2000) }).omit({ id: true, createdAt: true }),
  managed: { createdAt: t.songNotes.createdAt },
  // Qualquer integrante comenta; só o autor ou líderes removem
  canWrite: (ctx, op) => op !== 'update' || can(ctx, 'songs:write'),
  prepareInsert: (ctx, row) => (can(ctx, 'songs:write') ? row : { ...row, authorId: myMemberId(ctx) }),
  guardDelete: (ctx, existing) => {
    if (!can(ctx, 'songs:write') && existing.authorId !== myMemberId(ctx)) {
      throw ApiError.forbidden('Você só pode remover as suas observações.')
    }
  },
  bulkDelete: true,
}

/** Favoritos e histórico: cada usuário só vê e altera os próprios */
function ownedByUser(table: typeof t.favorites | typeof t.songViews, managed: Resource['managed']): Resource {
  return {
    table,
    id: table.id,
    // O cliente informa só a música; usuário e data são definidos pelo servidor
    insertSchema: z.object({ id: z.uuid().optional(), songId: z.uuid() }),
    updateSchema: z.object({}),
    managed,
    canWrite: (_ctx, op) => op !== 'update',
    scope: (ctx) => eq(table.userId, ctx.session.user.id),
    prepareInsert: (ctx, row) => ({ id: row.id, songId: row.songId, userId: ctx.session.user.id }),
    bulkDelete: true,
  }
}

const favorites = ownedByUser(t.favorites, { createdAt: t.favorites.createdAt })
const songViews = ownedByUser(t.songViews, { viewedAt: t.songViews.viewedAt })

const eventRefinements = {
  title: required(200),
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  location: text(200),
  description: text(2000),
}

const events: Resource = {
  table: t.events,
  id: t.events.id,
  insertSchema: insertOf(t.events, eventRefinements).omit({ createdAt: true, updatedAt: true }),
  updateSchema: updateOf(t.events, eventRefinements).omit({ id: true, createdAt: true, updatedAt: true }),
  managed: { createdAt: t.events.createdAt, updatedAt: t.events.updatedAt },
  canWrite: (ctx) => can(ctx, 'events:write', 'repertoires:write', 'rehearsals:write'),
}

const repertoireRefinements = { name: required(200), description: text(2000), notes: text(2000) }

const repertoires: Resource = {
  table: t.repertoires,
  id: t.repertoires.id,
  insertSchema: insertOf(t.repertoires, repertoireRefinements).omit({ createdAt: true, updatedAt: true }),
  updateSchema: updateOf(t.repertoires, repertoireRefinements).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true }),
  managed: { createdAt: t.repertoires.createdAt, updatedAt: t.repertoires.updatedAt },
  canWrite: (ctx) => can(ctx, 'repertoires:write'),
  prepareInsert: (ctx, row) => ({ ...row, createdBy: ctx.session.user.id }),
}

const repertoireSongRefinements = {
  key: musicalKey,
  position: z.number().int().min(0).max(500),
  instrumentation: text(80),
  notes: text(500),
}

const repertoireSongs: Resource = {
  table: t.repertoireSongs,
  id: t.repertoireSongs.id,
  insertSchema: insertOf(t.repertoireSongs, repertoireSongRefinements),
  updateSchema: updateOf(t.repertoireSongs, repertoireSongRefinements).omit({ id: true }),
  managed: {},
  canWrite: (ctx) => can(ctx, 'repertoires:write'),
  bulkDelete: true,
}

const schedules: Resource = {
  table: t.schedules,
  id: t.schedules.id,
  insertSchema: insertOf(t.schedules, { notes: text(2000) }).omit({ createdAt: true, updatedAt: true }),
  updateSchema: updateOf(t.schedules, { notes: text(2000) }).omit({ id: true, createdAt: true, updatedAt: true }),
  managed: { createdAt: t.schedules.createdAt, updatedAt: t.schedules.updatedAt },
  canWrite: (ctx) => can(ctx, 'schedules:write'),
}

const scheduleMembers: Resource = {
  table: t.scheduleMembers,
  id: t.scheduleMembers.id,
  insertSchema: insertOf(t.scheduleMembers),
  updateSchema: updateOf(t.scheduleMembers).omit({ id: true }),
  managed: {},
  canWrite: (ctx) => can(ctx, 'schedules:write'),
  bulkDelete: true,
}

const rehearsals: Resource = {
  table: t.rehearsals,
  id: t.rehearsals.id,
  insertSchema: insertOf(t.rehearsals, { notes: text(2000) }).omit({ createdAt: true, updatedAt: true }),
  updateSchema: updateOf(t.rehearsals, { notes: text(2000) }).omit({ id: true, createdAt: true, updatedAt: true }),
  managed: { createdAt: t.rehearsals.createdAt, updatedAt: t.rehearsals.updatedAt },
  canWrite: (ctx) => can(ctx, 'rehearsals:write'),
  bulkDelete: true,
}

/** Preparação: cada integrante registra a sua; líderes podem ajustar qualquer uma */
const songPreparations: Resource = {
  table: t.songPreparations,
  id: t.songPreparations.id,
  insertSchema: insertOf(t.songPreparations).omit({ updatedAt: true }),
  updateSchema: updateOf(t.songPreparations).omit({ id: true, updatedAt: true, repertoireSongId: true, memberId: true }),
  managed: { updatedAt: t.songPreparations.updatedAt },
  canWrite: (ctx, op) => op !== 'delete' || can(ctx, 'repertoires:write'),
  prepareInsert: (ctx, row) => {
    if (can(ctx, 'repertoires:write')) return row
    const memberId = myMemberId(ctx)
    if (!memberId) throw ApiError.forbidden('Seu usuário não está vinculado a um integrante da equipe.')
    return { ...row, memberId }
  },
  guardUpdate: (ctx, existing, patch) => {
    if (!can(ctx, 'repertoires:write') && existing.memberId !== myMemberId(ctx)) {
      throw ApiError.forbidden('Você só pode alterar a sua própria preparação.')
    }
    return patch
  },
  bulkDelete: true,
}

/** Notificações: gerais (userId nulo) ou pessoais; cada um marca como lidas as suas */
const notifications: Resource = {
  table: t.notifications,
  id: t.notifications.id,
  insertSchema: insertOf(t.notifications, { title: required(200), message: required(1000), link: internalLink }).omit({
    createdAt: true,
    dedupeKey: true,
    sentAt: true,
    event: true,
    entityType: true,
    entityId: true,
    metadata: true,
  }),
  updateSchema: updateOf(t.notifications).pick({ readBy: true }),
  managed: { createdAt: t.notifications.createdAt },
  // Avisos são gerados por ações de líderes (repertório, escala, ensaio, tom); todos marcam como lidas
  canWrite: (ctx, op) =>
    op === 'update' ||
    (op === 'insert' ? can(ctx, 'songs:write', 'repertoires:write', 'schedules:write', 'rehearsals:write', 'events:write') : can(ctx, 'repertoires:write')),
  scope: (ctx) => or(isNull(t.notifications.userId), eq(t.notifications.userId, ctx.session.user.id)),
  prepareInsert: (_ctx, row) => ({ ...row, readBy: [] }),
  guardUpdate: (ctx, existing, patch) => {
    const me = ctx.session.user.id
    const before = new Set((existing.readBy as string[] | undefined) ?? [])
    const after = new Set((patch.readBy as string[] | undefined) ?? [...before])
    const changed = [...before, ...after].filter((id) => before.has(id) !== after.has(id))
    if (changed.some((id) => id !== me)) throw ApiError.forbidden('Você só pode marcar as suas notificações.')
    return { readBy: [...after] }
  },
}

/** Recursos acessíveis via /api/<caminho>. Os nomes seguem as tabelas do banco. */
export const RESOURCES = {
  members,
  users,
  songs,
  song_videos: songVideos,
  song_links: songLinks,
  song_notes: songNotes,
  favorites,
  song_views: songViews,
  events,
  repertoires,
  repertoire_songs: repertoireSongs,
  schedules,
  schedule_members: scheduleMembers,
  rehearsals,
  song_preparations: songPreparations,
  notifications,
} satisfies Record<string, Resource>

export type ResourceName = keyof typeof RESOURCES

/** /api/song-videos → song_videos */
export function resolveResource(path: string): { name: ResourceName; resource: Resource } | null {
  const name = path.replace(/-/g, '_')
  return name in RESOURCES ? { name: name as ResourceName, resource: RESOURCES[name as ResourceName] } : null
}
