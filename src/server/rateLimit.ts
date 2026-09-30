/**
 * Limite de tentativas guardado no PostgreSQL (funciona entre instâncias das Vercel Functions).
 * Cada chave tem uma janela fixa; a contagem é incrementada numa única instrução atômica.
 */
import { createHash } from 'node:crypto'
import { lt, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { rateLimits } from '../db/schema.js'
import { ApiError } from './http.js'

export interface Limit {
  /** Máximo de tentativas na janela */
  max: number
  /** Duração da janela, em segundos */
  windowSeconds: number
}

export const LIMITS = {
  loginPerIp: { max: 30, windowSeconds: 15 * 60 },
  loginPerEmail: { max: 10, windowSeconds: 15 * 60 },
  signupPerIp: { max: 10, windowSeconds: 60 * 60 },
  emailPerIp: { max: 20, windowSeconds: 60 * 60 },
  emailPerAddress: { max: 5, windowSeconds: 60 * 60 },
  verifyPerIp: { max: 60, windowSeconds: 60 * 60 },
  changeEmailPerIp: { max: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, Limit>

/** Intervalo mínimo entre dois e-mails de confirmação para o mesmo endereço */
export const RESEND_COOLDOWN_SECONDS = 60

/** Endereço IP do cliente (definido pela Vercel; no desenvolvimento, "local") */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('x-real-ip')?.trim() || forwarded || 'local'
}

/** E-mails e IPs entram na chave apenas como hash */
const keyOf = (scope: string, value: string) => `${scope}:${createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 32)}`

/** Conta uma tentativa; retorna quantos segundos faltam para liberar quando o limite foi excedido */
export async function hit(db: Database, scope: string, value: string, limit: Limit): Promise<number | null> {
  const key = keyOf(scope, value)
  const window = sql`make_interval(secs => ${limit.windowSeconds})`
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < now() - ${window} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < now() - ${window} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart })
  // Limpeza ocasional de janelas antigas
  if (Math.random() < 0.02) await db.delete(rateLimits).where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`))
  if (!row || row.count <= limit.max) return null
  const elapsed = (Date.now() - new Date(row.windowStart).getTime()) / 1000
  return Math.max(1, Math.ceil(limit.windowSeconds - elapsed))
}

/** Como `hit`, mas responde 429 quando o limite é excedido */
export async function enforce(db: Database, scope: string, value: string, limit: Limit, message?: string) {
  const retryAfter = await hit(db, scope, value, limit)
  if (retryAfter !== null) throw ApiError.tooManyRequests(retryAfter, message)
}
