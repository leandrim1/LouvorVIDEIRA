/**
 * Envio Web Push com VAPID (padrão aberto: Chrome/Android, Firefox, Edge e Safari/iOS 16.4+).
 * A chave privada (VAPID_PRIVATE_KEY) existe só no servidor; o navegador recebe apenas a pública.
 *
 * Cada aparelho tem sua inscrição. Inscrições que o serviço de push informa como expiradas
 * (404/410) são desativadas automaticamente e não recebem novas tentativas.
 */
import type { Agent } from 'node:https'
import { and, eq, inArray } from 'drizzle-orm'
import webpush from 'web-push'
import type { Database } from '../db/index.js'
import { notificationDeliveryLogs, notifications, pushSubscriptions } from '../db/schema.js'

export interface PushPayload {
  title: string
  body: string
  /** Caminho aberto ao tocar na notificação (sempre interno, ex.: /repertorios/:id) */
  url: string
  notificationId: string
  /** Mesma tag = o aparelho substitui em vez de empilhar (evita duplicadas) */
  tag: string
}

export interface PushConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || (process.env.APP_URL?.trim() ?? '')
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

/* ------------------------------------------------------------------ */
/* Serviços de push aceitos (evita que o servidor faça requisições a    */
/* endereços arbitrários informados pelo navegador)                    */
/* ------------------------------------------------------------------ */

const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
]
let extraHosts: RegExp[] = []
let testAgent: Agent | undefined
/** Somente testes automatizados: servidor de push local (HTTPS com certificado próprio) */
export function allowPushHostsForTests(hosts: RegExp[], agent?: Agent) {
  extraHosts = hosts
  testAgent = agent
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (extraHosts.some((h) => h.test(url.host))) return true
  return PUSH_HOSTS.some((h) => h.test(url.hostname))
}

/* ------------------------------------------------------------------ */
/* Envio                                                               */
/* ------------------------------------------------------------------ */

type Subscription = typeof pushSubscriptions.$inferSelect
export type DeliveryStatus = 'SENT' | 'FAILED' | 'EXPIRED' | 'REMOVED'

export interface DeliveryResult {
  subscriptionId: string
  status: DeliveryStatus
}

async function sendOne(config: PushConfig, sub: Subscription, payload: PushPayload): Promise<{ status: DeliveryStatus; error?: string }> {
  if (!isAllowedPushEndpoint(sub.endpoint)) return { status: 'REMOVED', error: 'Endereço de push não permitido' }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      TTL: 60 * 60 * 24,
      urgency: 'high',
      topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
      timeout: 10_000,
      ...(testAgent ? { agent: testAgent } : {}),
    })
    return { status: 'SENT' }
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    // 404/410: a inscrição não existe mais (app desinstalado, permissão removida, expirou)
    if (statusCode === 404 || statusCode === 410) return { status: 'EXPIRED', error: `HTTP ${statusCode}` }
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'FAILED', error: `${statusCode ? `HTTP ${statusCode}: ` : ''}${message}`.slice(0, 300) }
  }
}

/**
 * Envia para todos os aparelhos ativos da pessoa. Uma falha não impede as outras;
 * cada resultado vira um registro em notification_delivery_logs.
 */
export async function pushToUser(db: Database, userId: string, payload: PushPayload): Promise<DeliveryResult[]> {
  const config = pushConfig()
  if (!config) return []
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.active, true)))
  if (subs.length === 0) return []

  const results = await Promise.all(subs.map(async (sub) => ({ sub, result: await sendOne(config, sub, payload) })))
  const now = new Date()
  await db.insert(notificationDeliveryLogs).values(
    results.map(({ sub, result }) => ({
      notificationId: payload.notificationId,
      subscriptionId: sub.id,
      status: result.status,
      error: result.error ?? null,
      sentAt: now,
    })),
  )
  const dead = results.filter(({ result }) => result.status === 'EXPIRED' || result.status === 'REMOVED').map(({ sub }) => sub.id)
  if (dead.length) await db.update(pushSubscriptions).set({ active: false, updatedAt: now }).where(inArray(pushSubscriptions.id, dead))
  const ok = results.filter(({ result }) => result.status === 'SENT').map(({ sub }) => sub.id)
  if (ok.length) {
    await db.update(pushSubscriptions).set({ lastUsedAt: now }).where(inArray(pushSubscriptions.id, ok))
    await db.update(notifications).set({ sentAt: now }).where(eq(notifications.id, payload.notificationId))
  }
  for (const { result } of results) {
    if (result.status === 'FAILED') console.error('[push] falha no envio:', result.error)
  }
  return results.map(({ sub, result }) => ({ subscriptionId: sub.id, status: result.status }))
}
