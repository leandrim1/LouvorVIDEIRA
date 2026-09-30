/**
 * Notificações: central no sistema + push nos aparelhos.
 *
 *   Evento (repertório, ensaio, escala) → servidor identifica as pessoas relacionadas
 *   → cria a notificação de cada uma (sem duplicar) → push para os aparelhos ativos
 *   → service worker mostra a notificação nativa → toque abre o conteúdo.
 *
 * O conteúdo e os destinatários são calculados aqui a partir do banco; o navegador só informa
 * qual evento aconteceu. Falhas de push nunca desfazem a criação do repertório/ensaio/escala.
 */
import { createHash } from 'node:crypto'
import { and, count, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import {
  events,
  notificationDeliveryLogs,
  notificationPreferences,
  notifications,
  pushSubscriptions,
  rehearsals,
  repertoireSongs,
  repertoires,
  scheduleMembers,
  schedules,
  users,
} from '../db/schema.js'
import { EVENT_TYPE_LABELS, MEMBER_ROLE_LABELS } from '../lib/constants.js'
import { hasPermission, type Permission } from '../lib/permissions.js'
import { requireApproved, type Session } from './auth.js'
import { ApiError, json, noContent, readJson } from './http.js'
import { describeDevice } from './loginSecurity.js'
import { isAllowedPushEndpoint, pushConfig, pushConfigStatus, pushToUser } from './push.js'

export interface NotificationContext {
  request: Request
  method: string
  url: URL
  db: Database
  session: () => Promise<Session | null>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const methodNotAllowed = () => new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')

/* ------------------------------------------------------------------ */
/* Tipos de evento e preferências                                      */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_EVENTS = [
  'REPERTOIRE_CREATED',
  'REPERTOIRE_UPDATED',
  'REHEARSAL_CREATED',
  'REHEARSAL_UPDATED',
  'SCHEDULE_CREATED',
  'SCHEDULE_UPDATED',
  'GENERAL',
] as const
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

type Category = 'repertoires' | 'repertoireUpdates' | 'rehearsals' | 'schedules' | 'general'
type Preferences = typeof notificationPreferences.$inferSelect

const DEFAULT_PREFERENCES = { repertoires: true, repertoireUpdates: true, rehearsals: true, schedules: true, general: true, pushEnabled: true }

/** Quem pode disparar cada evento (a mesma permissão de quem cria o conteúdo) */
const DISPATCH_PERMISSION: Record<Exclude<NotificationEvent, 'GENERAL'>, Permission> = {
  REPERTOIRE_CREATED: 'repertoires:write',
  REPERTOIRE_UPDATED: 'repertoires:write',
  REHEARSAL_CREATED: 'rehearsals:write',
  REHEARSAL_UPDATED: 'rehearsals:write',
  SCHEDULE_CREATED: 'schedules:write',
  SCHEDULE_UPDATED: 'schedules:write',
}

/** Alterações repetidas dentro desta janela geram um único aviso */
const UPDATE_WINDOW_MINUTES = 10

/* ------------------------------------------------------------------ */
/* Datas e textos                                                      */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!
const when = (date: string, time: string) => `${dayMonth(date)} às ${time}`

/** Evento já passou (com um dia de tolerância para fuso horário)? */
function isPastDate(date: string) {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  return date < yesterday
}

function joinPt(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/* ------------------------------------------------------------------ */
/* Destinatários                                                       */
/* ------------------------------------------------------------------ */

interface Recipient {
  userId: string
  memberId: string | null
  name: string
}

/** Contas ativas vinculadas aos integrantes informados */
async function usersForMembers(db: Database, memberIds: string[]): Promise<Recipient[]> {
  if (memberIds.length === 0) return []
  return db
    .select({ userId: users.id, memberId: users.memberId, name: users.name })
    .from(users)
    .where(and(inArray(users.memberId, memberIds), eq(users.status, 'APPROVED'), eq(users.emailVerified, true)))
}

async function allActiveUsers(db: Database): Promise<Recipient[]> {
  return db
    .select({ userId: users.id, memberId: users.memberId, name: users.name })
    .from(users)
    .where(and(eq(users.status, 'APPROVED'), eq(users.emailVerified, true)))
}

/** Integrantes da escala do evento, com as funções de cada um */
async function scheduledMembers(db: Database, eventId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ memberId: scheduleMembers.memberId, role: scheduleMembers.role })
    .from(scheduleMembers)
    .innerJoin(schedules, eq(schedules.id, scheduleMembers.scheduleId))
    .where(eq(schedules.eventId, eventId))
  const map = new Map<string, string[]>()
  for (const r of rows) map.set(r.memberId, [...(map.get(r.memberId) ?? []), r.role])
  return map
}

/** Integrantes relacionados a um repertório: escala do culto + vocais das músicas */
async function repertoireMemberIds(db: Database, repertoireId: string, eventId: string): Promise<string[]> {
  const scheduled = await scheduledMembers(db, eventId)
  const vocals = await db
    .select({ memberId: repertoireSongs.leadVocalId })
    .from(repertoireSongs)
    .where(eq(repertoireSongs.repertoireId, repertoireId))
  return [...new Set([...scheduled.keys(), ...vocals.map((v) => v.memberId).filter((m): m is string => Boolean(m))])]
}

/* ------------------------------------------------------------------ */
/* Criação + push                                                      */
/* ------------------------------------------------------------------ */

interface Draft {
  userId: string
  title: string
  message: string
  category: Category
  dedupeKey: string
  metadata?: Record<string, unknown>
}

interface Common {
  type: typeof notifications.$inferInsert.type
  event: NotificationEvent
  entityType: string | null
  entityId: string | null
  link: string
}

export interface DispatchResult {
  created: number
  pushed: number
  failed: number
}

async function preferencesFor(db: Database, userIds: string[]) {
  const rows: Preferences[] = userIds.length
    ? await db.select().from(notificationPreferences).where(inArray(notificationPreferences.userId, userIds))
    : []
  const map = new Map(rows.map((r) => [r.userId, r]))
  return (userId: string) => map.get(userId) ?? { ...DEFAULT_PREFERENCES, userId }
}

/**
 * Cria as notificações (uma por pessoa; a chave de deduplicação impede repetições)
 * e envia o push apenas das que foram criadas agora.
 */
export async function deliver(db: Database, drafts: Draft[], common: Common): Promise<DispatchResult> {
  if (drafts.length === 0) return { created: 0, pushed: 0, failed: 0 }
  const prefs = await preferencesFor(db, drafts.map((d) => d.userId))
  const allowed = drafts.filter((d) => prefs(d.userId)[d.category])
  if (allowed.length === 0) return { created: 0, pushed: 0, failed: 0 }

  const created = await db
    .insert(notifications)
    .values(
      allowed.map((d) => ({
        userId: d.userId,
        type: common.type,
        title: d.title,
        message: d.message,
        link: common.link,
        event: common.event,
        entityType: common.entityType,
        entityId: common.entityId,
        metadata: d.metadata ?? {},
        dedupeKey: d.dedupeKey,
      })),
    )
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning()

  let pushed = 0
  let failed = 0
  const results = await Promise.allSettled(
    created
      .filter((n) => n.userId && prefs(n.userId).pushEnabled)
      .map((n) =>
        pushToUser(db, n.userId!, {
          title: 'Louvor Videira',
          body: `${n.title}\n${n.message}`,
          url: n.link ?? '/notificacoes',
          notificationId: n.id,
          tag: n.id,
        }),
      ),
  )
  for (const r of results) {
    if (r.status === 'fulfilled') {
      pushed += r.value.filter((d) => d.status === 'SENT').length
      failed += r.value.filter((d) => d.status !== 'SENT').length
    } else {
      failed++
      console.error('[push] erro ao enviar:', r.reason)
    }
  }
  return { created: created.length, pushed, failed }
}

/** Aviso administrativo (ex.: nova solicitação de acesso) para os administradores */
export async function notifyAdmins(db: Database, input: { title: string; message: string; link: string; dedupeKey: string }) {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'APPROVED')))
  return deliver(
    db,
    admins.map((a) => ({ userId: a.id, title: input.title, message: input.message, category: 'general' as const, dedupeKey: `${input.dedupeKey}:${a.id}` })),
    { type: 'system', event: 'GENERAL', entityType: null, entityId: null, link: input.link },
  )
}

/* ------------------------------------------------------------------ */
/* Eventos do sistema                                                  */
/* ------------------------------------------------------------------ */

const bucket = () => Math.floor(Date.now() / (UPDATE_WINDOW_MINUTES * 60_000))

async function dispatchRepertoire(db: Database, actorId: string, event: NotificationEvent, repertoireId: string): Promise<DispatchResult> {
  const [row] = await db
    .select({ repertoire: repertoires, event: events })
    .from(repertoires)
    .innerJoin(events, eq(events.id, repertoires.eventId))
    .where(eq(repertoires.id, repertoireId))
    .limit(1)
  if (!row) throw ApiError.notFound('Repertório não encontrado.')
  // Rascunhos e cultos que já passaram não geram aviso
  if (row.repertoire.status !== 'published' || isPastDate(row.event.date)) return { created: 0, pushed: 0, failed: 0 }

  const memberIds = await repertoireMemberIds(db, repertoireId, row.event.id)
  // Sem escala nem vocais definidos, o repertório vale para a equipe toda
  const recipients = (memberIds.length ? await usersForMembers(db, memberIds) : await allActiveUsers(db)).filter((r) => r.userId !== actorId)
  const name = row.repertoire.name
  const whenText = when(row.event.date, row.event.startTime)
  const created = event === 'REPERTOIRE_CREATED'
  return deliver(
    db,
    recipients.map((r) => ({
      userId: r.userId,
      title: created ? 'Novo repertório disponível' : 'Repertório atualizado',
      message: created
        ? `${name} — ${whenText}. Confira as músicas e os tons do repertório.`
        : `${name} (${whenText}) foi atualizado. Confira as músicas e os tons.`,
      category: created ? 'repertoires' : 'repertoireUpdates',
      dedupeKey: created ? `${event}:${repertoireId}:${r.userId}` : `${event}:${repertoireId}:${r.userId}:${bucket()}`,
    })),
    { type: 'repertoire', event, entityType: 'repertoire', entityId: repertoireId, link: `/repertorios/${repertoireId}` },
  )
}

async function dispatchRehearsal(db: Database, actorId: string, event: NotificationEvent, rehearsalId: string): Promise<DispatchResult> {
  const [row] = await db
    .select({ rehearsal: rehearsals, event: events })
    .from(rehearsals)
    .innerJoin(events, eq(events.id, rehearsals.eventId))
    .where(eq(rehearsals.id, rehearsalId))
    .limit(1)
  if (!row) throw ApiError.notFound('Ensaio não encontrado.')
  if (isPastDate(row.event.date)) return { created: 0, pushed: 0, failed: 0 }

  // Integrantes do repertório ensaiado; sem repertório vinculado, a equipe toda
  let memberIds: string[] = []
  if (row.rehearsal.repertoireId) {
    const [rep] = await db.select({ eventId: repertoires.eventId }).from(repertoires).where(eq(repertoires.id, row.rehearsal.repertoireId)).limit(1)
    if (rep) memberIds = await repertoireMemberIds(db, row.rehearsal.repertoireId, rep.eventId)
  }
  const recipients = (memberIds.length ? await usersForMembers(db, memberIds) : await allActiveUsers(db)).filter((r) => r.userId !== actorId)
  const whenText = when(row.event.date, row.event.startTime)
  const created = event === 'REHEARSAL_CREATED'
  return deliver(
    db,
    recipients.map((r) => ({
      userId: r.userId,
      title: created ? 'Novo ensaio' : 'Ensaio atualizado',
      message: created
        ? `Novo ensaio agendado para ${whenText}${row.event.location ? ` — ${row.event.location}` : ''}.`
        : `O ensaio de ${whenText} foi atualizado.`,
      category: 'rehearsals',
      dedupeKey: created ? `${event}:${rehearsalId}:${r.userId}` : `${event}:${rehearsalId}:${r.userId}:${bucket()}`,
    })),
    { type: 'rehearsal', event, entityType: 'rehearsal', entityId: rehearsalId, link: `/ensaios/${rehearsalId}` },
  )
}

async function dispatchSchedule(db: Database, actorId: string, event: NotificationEvent, scheduleId: string): Promise<DispatchResult> {
  const [row] = await db
    .select({ schedule: schedules, event: events })
    .from(schedules)
    .innerJoin(events, eq(events.id, schedules.eventId))
    .where(eq(schedules.id, scheduleId))
    .limit(1)
  if (!row) throw ApiError.notFound('Escala não encontrada.')
  if (isPastDate(row.event.date)) return { created: 0, pushed: 0, failed: 0 }

  const roles = await scheduledMembers(db, row.event.id)
  const recipients = (await usersForMembers(db, [...roles.keys()])).filter((r) => r.userId !== actorId)
  // Quem já recebeu "Você foi escalado" desta escala recebe só "escala atualizada"
  const already = new Set(
    (
      await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(and(eq(notifications.event, 'SCHEDULE_CREATED'), eq(notifications.entityId, scheduleId)))
    ).map((n) => n.userId),
  )
  const eventName = row.event.title || EVENT_TYPE_LABELS[row.event.type]
  const day = `${weekday(row.event.date)}, ${when(row.event.date, row.event.startTime)}`
  const drafts = recipients.map((r) => {
    const memberRoles = (roles.get(r.memberId ?? '') ?? []).map((role) => MEMBER_ROLE_LABELS[role as keyof typeof MEMBER_ROLE_LABELS] ?? role)
    const isNew = event === 'SCHEDULE_CREATED' || !already.has(r.userId)
    return {
      userId: r.userId,
      title: isNew ? 'Você foi escalado' : 'Escala atualizada',
      message: isNew
        ? `Você foi escalado${memberRoles.length ? ` como ${joinPt(memberRoles)}` : ''} para ${eventName} (${day}).`
        : `A escala de ${eventName} (${day}) foi atualizada.`,
      category: 'schedules' as const,
      dedupeKey: isNew ? `SCHEDULE_CREATED:${scheduleId}:${r.userId}` : `SCHEDULE_UPDATED:${scheduleId}:${r.userId}:${bucket()}`,
      metadata: { roles: roles.get(r.memberId ?? '') ?? [], created: isNew },
    }
  })
  // Registra cada linha com o evento certo (novo escalado × escala alterada)
  const results = await Promise.all(
    (['SCHEDULE_CREATED', 'SCHEDULE_UPDATED'] as const).map((ev) =>
      deliver(
        db,
        drafts.filter((d) => (d.metadata.created ? 'SCHEDULE_CREATED' : 'SCHEDULE_UPDATED') === ev),
        { type: 'schedule', event: ev, entityType: 'schedule', entityId: scheduleId, link: `/escalas/${scheduleId}` },
      ),
    ),
  )
  return results.reduce((a, b) => ({ created: a.created + b.created, pushed: a.pushed + b.pushed, failed: a.failed + b.failed }))
}

export async function dispatchEvent(db: Database, session: Session, event: Exclude<NotificationEvent, 'GENERAL'>, entityId: string) {
  if (!hasPermission(session.user.role, DISPATCH_PERMISSION[event])) throw ApiError.forbidden()
  if (event.startsWith('REPERTOIRE')) return dispatchRepertoire(db, session.user.id, event, entityId)
  if (event.startsWith('REHEARSAL')) return dispatchRehearsal(db, session.user.id, event, entityId)
  return dispatchSchedule(db, session.user.id, event, entityId)
}

/* ------------------------------------------------------------------ */
/* Rotas /api/notifications/*                                          */
/* ------------------------------------------------------------------ */

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({
      p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/, 'Chave inválida'),
      auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}={0,2}$/, 'Chave inválida'),
    }),
  }),
  /** Registro automático ao abrir o app: não reativa aparelhos removidos pela pessoa */
  auto: z.boolean().optional().default(false),
})
const unsubscribeSchema = z.object({ endpoint: z.string().max(1000), remove: z.boolean().optional().default(false) })
const readSchema = z.object({ id: z.uuid() })
const dispatchSchema = z.object({
  event: z.enum(['REPERTOIRE_CREATED', 'REPERTOIRE_UPDATED', 'REHEARSAL_CREATED', 'REHEARSAL_UPDATED', 'SCHEDULE_CREATED', 'SCHEDULE_UPDATED']),
  entityId: z.uuid(),
})
const preferencesSchema = z
  .object({
    repertoires: z.boolean(),
    repertoireUpdates: z.boolean(),
    rehearsals: z.boolean(),
    schedules: z.boolean(),
    general: z.boolean(),
    pushEnabled: z.boolean(),
  })
  .partial()

/** Notificações visíveis para a pessoa (gerais da equipe + as dela) */
const visibleTo = (userId: string) => or(isNull(notifications.userId), eq(notifications.userId, userId))

export async function notificationsRoute(ctx: NotificationContext, action: string | undefined, id: string | undefined): Promise<Response> {
  const { db, request, method } = ctx
  // Chave pública VAPID: pode ser lida pelo navegador (a privada nunca sai do servidor)
  if (action === 'config') {
    if (method !== 'GET') throw methodNotAllowed()
    const config = pushConfig()
    return json({ publicKey: config?.publicKey ?? null, enabled: Boolean(config) })
  }

  const session = requireApproved(await ctx.session())
  const me = session.user.id

  switch (action) {
    case undefined: {
      if (method !== 'GET') throw methodNotAllowed()
      const rows = await db.select().from(notifications).where(visibleTo(me)).orderBy(sql`${notifications.createdAt} desc`).limit(200)
      return json(rows.map(({ dedupeKey: _key, ...n }) => ({ ...n, read: n.readBy.includes(me) })))
    }

    case 'subscribe': {
      if (method === 'POST') {
        const { subscription, auto } = subscriptionSchema.parse(await readJson(request))
        if (!isAllowedPushEndpoint(subscription.endpoint)) throw ApiError.badRequest('Serviço de notificações não suportado.')
        const [existing] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint)).limit(1)
        if (auto && existing?.userId === me && existing.revokedAt) {
          return json({ id: existing.id, active: false })
        }
        const info = describeDevice(request.headers.get('user-agent') ?? '')
        const fields = {
          userId: me,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          deviceName: info.name,
          browser: info.browser,
          platform: info.os,
          active: true,
          revokedAt: null,
          updatedAt: new Date(),
        }
        // O endereço pertence ao aparelho: se outra conta usava este navegador, ele passa para quem está logado agora
        const [row] = await db
          .insert(pushSubscriptions)
          .values({ ...fields, endpoint: subscription.endpoint })
          .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: fields })
          .returning({ id: pushSubscriptions.id, active: pushSubscriptions.active })
        return json(row, existing ? 200 : 201)
      }
      if (method === 'DELETE') {
        const { endpoint, remove } = unsubscribeSchema.parse(await readJson(request))
        await db
          .update(pushSubscriptions)
          .set({ active: false, updatedAt: new Date(), ...(remove ? { revokedAt: new Date() } : {}) })
          .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, me)))
        return noContent()
      }
      throw methodNotAllowed()
    }

    case 'devices': {
      if (method === 'GET' && !id) {
        const rows = await db
          .select({
            id: pushSubscriptions.id,
            deviceName: pushSubscriptions.deviceName,
            browser: pushSubscriptions.browser,
            platform: pushSubscriptions.platform,
            createdAt: pushSubscriptions.createdAt,
            lastUsedAt: pushSubscriptions.lastUsedAt,
            updatedAt: pushSubscriptions.updatedAt,
            active: pushSubscriptions.active,
            endpoint: pushSubscriptions.endpoint,
          })
          .from(pushSubscriptions)
          .where(and(eq(pushSubscriptions.userId, me), eq(pushSubscriptions.active, true)))
          .orderBy(sql`${pushSubscriptions.updatedAt} desc`)
        // O endereço não sai do servidor; o navegador reconhece o próprio aparelho pelo hash
        return json(rows.map(({ endpoint, ...d }) => ({ ...d, endpointHash: createHash('sha256').update(endpoint).digest('hex') })))
      }
      if (method === 'DELETE' && id) {
        if (!UUID.test(id)) throw ApiError.notFound('Aparelho não encontrado.')
        const [row] = await db
          .update(pushSubscriptions)
          .set({ active: false, revokedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, me)))
          .returning({ id: pushSubscriptions.id })
        if (!row) throw ApiError.notFound('Aparelho não encontrado.')
        return noContent()
      }
      throw methodNotAllowed()
    }

    case 'read': {
      if (method !== 'POST') throw methodNotAllowed()
      const { id: notificationId } = readSchema.parse(await readJson(request))
      const [row] = await db
        .update(notifications)
        .set({ readBy: sql`array_append(${notifications.readBy}, ${me}::uuid)` })
        .where(and(eq(notifications.id, notificationId), visibleTo(me), sql`not (${me}::uuid = any(${notifications.readBy}))`))
        .returning({ id: notifications.id })
      if (!row) {
        const [exists] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, notificationId), visibleTo(me)))
        if (!exists) throw ApiError.notFound('Notificação não encontrada.')
      }
      return noContent()
    }

    case 'read-all': {
      if (method !== 'POST') throw methodNotAllowed()
      const rows = await db
        .update(notifications)
        .set({ readBy: sql`array_append(${notifications.readBy}, ${me}::uuid)` })
        .where(and(visibleTo(me), sql`not (${me}::uuid = any(${notifications.readBy}))`))
        .returning({ id: notifications.id })
      return json({ updated: rows.length })
    }

    case 'preferences': {
      if (method === 'GET') {
        const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, me)).limit(1)
        const { userId: _u, updatedAt: _t, ...prefs } = row ?? { ...DEFAULT_PREFERENCES, userId: me, updatedAt: new Date() }
        return json(prefs)
      }
      if (method === 'PUT' || method === 'PATCH') {
        const patch = preferencesSchema.parse(await readJson(request))
        const [row] = await db
          .insert(notificationPreferences)
          .values({ ...DEFAULT_PREFERENCES, ...patch, userId: me })
          .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...patch, updatedAt: new Date() } })
          .returning()
        const { userId: _u, updatedAt: _t, ...prefs } = row!
        return json(prefs)
      }
      throw methodNotAllowed()
    }

    case 'dispatch': {
      if (method !== 'POST') throw methodNotAllowed()
      const input = dispatchSchema.parse(await readJson(request))
      return json(await dispatchEvent(db, session, input.event, input.entityId))
    }

    /* Push de teste para os próprios aparelhos (confere se as notificações chegam) */
    case 'test': {
      if (method !== 'POST') throw methodNotAllowed()
      const status = pushConfigStatus()
      if (status === 'not_configured') throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Notificações push não configuradas no servidor (VAPID).')
      if (status !== 'ok') throw new ApiError(503, 'SERVICE_UNAVAILABLE', `Chaves VAPID inválidas no servidor (${status.replace(/^invalid: /, '')}).`)
      // O teste ignora as categorias, mas respeita o botão geral "Notificações push"
      const pushEnabled = (await preferencesFor(db, [me]))(me).pushEnabled
      const [{ n: devices }] = await db
        .select({ n: count() })
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, me), eq(pushSubscriptions.active, true)))
      const [created] = await db
        .insert(notifications)
        .values({
          userId: me,
          type: 'system',
          title: 'Notificação de teste',
          message: 'Tudo certo! Você vai receber os avisos da equipe neste aparelho.',
          link: '/configuracoes#notificacoes',
          event: 'GENERAL',
          metadata: {},
          dedupeKey: `TEST:${me}:${Date.now()}`,
        })
        .returning()
      const results = pushEnabled
        ? await pushToUser(db, me, {
            title: 'Louvor Videira',
            body: `${created.title}\n${created.message}`,
            url: created.link ?? '/notificacoes',
            notificationId: created.id,
            tag: created.id,
          })
        : []
      // Só os aparelhos da própria pessoa: o motivo da falha ajuda a resolver sem abrir o banco
      return json({
        created: 1,
        pushEnabled,
        devices,
        pushed: results.filter((r) => r.status === 'SENT').length,
        failed: results.filter((r) => r.status !== 'SENT').length,
        errors: [...new Set(results.filter((r) => r.status !== 'SENT').map((r) => r.error ?? r.status))],
      })
    }

    /* Painel do administrador */
    case 'stats': {
      if (method !== 'GET') throw methodNotAllowed()
      if (!hasPermission(session.user.role, 'admin:access')) throw ApiError.forbidden()
      const [[usersWithPush], [devices], statuses] = await Promise.all([
        db
          .select({ n: sql<number>`count(distinct ${pushSubscriptions.userId})::int` })
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.active, true)),
        db.select({ n: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.active, true)),
        db.select({ status: notificationDeliveryLogs.status, n: count() }).from(notificationDeliveryLogs).groupBy(notificationDeliveryLogs.status),
      ])
      const by = (s: string) => statuses.find((r) => r.status === s)?.n ?? 0
      return json({
        enabled: Boolean(pushConfig()),
        usersWithPush: usersWithPush?.n ?? 0,
        devices: devices?.n ?? 0,
        sent: by('SENT'),
        failed: by('FAILED'),
        expired: by('EXPIRED') + by('REMOVED'),
      })
    }
  }
  throw ApiError.notFound('Rota não encontrada.')
}

