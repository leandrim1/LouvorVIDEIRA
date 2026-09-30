/**
 * Roteador da API (Vercel Functions e servidor de desenvolvimento do Vite).
 *
 *   React → /api/* → handleRequest → Drizzle ORM → Neon PostgreSQL
 *
 * Toda operação no banco acontece aqui, no servidor. Permissões vêm sempre da sessão
 * gravada no banco, nunca do que o navegador envia.
 */
import { and, asc, eq, getTableColumns, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { getDb, type Database } from '../db/index.js'
import { files } from '../db/schema.js'
import { hasPermission } from '../lib/permissions.js'
import { USER_ACTIONS, authRoute, userAction, type UserAction } from './accounts.js'
import { getSession, requireApproved, type Session } from './auth.js'
import { deleteFile, listFiles, uploadFile } from './files.js'
import { ApiError, json, noContent, readJson, toErrorResponse } from './http.js'
import { RESOURCES, resolveResource, type DbRow, type Resource, type ResourceContext } from './resources.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ROWS_PER_INSERT = 500
const MAX_BATCH = 30

interface RequestContext {
  request: Request
  url: URL
  method: string
  segments: string[]
  db: Database
  /** Sessão carregada sob demanda (uma consulta por requisição) */
  session: () => Promise<Session | null>
}

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

export async function handleRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') assertSameOrigin(request)
    const db = getDb()
    let sessionPromise: Promise<Session | null> | null = null
    const ctx: RequestContext = {
      request,
      url,
      method,
      segments: apiSegments(url),
      db,
      session: () => (sessionPromise ??= getSession(db, request)),
    }
    return await route(ctx)
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * Caminho depois de /api/. Na Vercel, o rewrite de vercel.json envia o caminho
 * em ?path=…; no servidor de desenvolvimento ele vem direto na URL.
 */
function apiSegments(url: URL): string[] {
  const raw = url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/?/, '')
  return raw.split('/').filter(Boolean).map(decodeSegment)
}

function decodeSegment(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    throw ApiError.badRequest('Endereço inválido.')
  }
}

/**
 * Proteção contra CSRF: além do cookie SameSite=Lax, requisições que alteram dados
 * precisam vir do mesmo site.
 */
function assertSameOrigin(request: Request) {
  const forbidden = () => ApiError.forbidden('Origem da requisição não permitida.')
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') throw forbidden()
  const origin = request.headers.get('origin')
  if (!origin) return
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw forbidden()
  }
  if (originHost !== host) throw forbidden()
}

const methodNotAllowed = () => new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')

async function route(ctx: RequestContext): Promise<Response> {
  const [head, id, action, ...rest] = ctx.segments
  if (!head) throw ApiError.notFound('Rota não encontrada.')

  switch (head) {
    case 'health':
      return health(ctx)
    case 'auth':
      return authRoute(ctx, id)
    case 'batch':
      if (ctx.method !== 'POST') throw methodNotAllowed()
      return batch(ctx)
    case 'export':
      if (ctx.method !== 'GET') throw methodNotAllowed()
      return exportAll(ctx)
    case 'files':
      return filesRoute(ctx, id)
  }

  if (head === 'users' && id && action && rest.length === 0 && (USER_ACTIONS as readonly string[]).includes(action)) {
    return userAction(ctx, id, action as UserAction)
  }

  const found = resolveResource(head)
  if (!found || action) throw ApiError.notFound('Rota não encontrada.')
  const rctx: ResourceContext = { db: ctx.db, session: requireApproved(await ctx.session()) }
  const { resource } = found

  if (id === undefined) {
    switch (ctx.method) {
      case 'GET':
        return json(await listRows(rctx, resource, ctx.url.searchParams))
      case 'POST':
        return insertRows(rctx, resource, await readJson(ctx.request))
      case 'DELETE':
        return deleteWhere(rctx, resource, ctx.url.searchParams)
      default:
        throw methodNotAllowed()
    }
  }

  switch (ctx.method) {
    case 'GET':
      return json(serialize(resource, await findRow(rctx, resource, id)))
    case 'PATCH':
    case 'PUT':
      return updateRow(rctx, resource, id, await readJson(ctx.request))
    case 'DELETE':
      return deleteRow(rctx, resource, id)
    default:
      throw methodNotAllowed()
  }
}

/* ------------------------------------------------------------------ */
/* CRUD genérico                                                       */
/* ------------------------------------------------------------------ */

type Columns = Record<string, PgColumn>

const columnsOf = (resource: Resource) => getTableColumns(resource.table) as Columns
const keyOf = (resource: Resource, column: PgColumn) =>
  Object.entries(columnsOf(resource)).find(([, c]) => c === column)?.[0]

const serialize = (resource: Resource, row: DbRow) => (resource.serialize ? resource.serialize(row) : row)

/** Filtros da query string (?songId=…&active=true&memberId=null) convertidos para SQL */
function filtersFrom(resource: Resource, params: URLSearchParams): SQL[] {
  const columns = columnsOf(resource)
  const conditions: SQL[] = []
  for (const [key, value] of params) {
    if (key === 'path') continue
    const column = columns[key]
    if (!column || resource.privateColumns?.includes(key) || column.dataType === 'array' || column.dataType === 'json') {
      throw ApiError.badRequest(`Filtro inválido: ${key.slice(0, 40)}`)
    }
    if (value === 'null') {
      conditions.push(isNull(column))
    } else if (column.dataType === 'boolean') {
      if (value !== 'true' && value !== 'false') throw ApiError.badRequest(`Filtro inválido: ${key}`)
      conditions.push(eq(column, value === 'true'))
    } else if (column.dataType === 'number') {
      const n = Number(value)
      if (!Number.isFinite(n)) throw ApiError.badRequest(`Filtro inválido: ${key}`)
      conditions.push(eq(column, n))
    } else {
      if (column.columnType === 'PgUUID' && !UUID.test(value)) throw ApiError.badRequest(`Filtro inválido: ${key}`)
      conditions.push(eq(column, value))
    }
  }
  return conditions
}

function where(rctx: ResourceContext, resource: Resource, ...conditions: (SQL | undefined)[]) {
  return and(...conditions, resource.scope?.(rctx))
}

function orderOf(resource: Resource) {
  const first = resource.managed.createdAt ?? resource.managed.viewedAt
  return first ? [asc(first), asc(resource.id)] : [asc(resource.id)]
}

async function listRows(rctx: ResourceContext, resource: Resource, params: URLSearchParams) {
  const rows = (await rctx.db
    .select()
    .from(resource.table)
    .where(where(rctx, resource, ...filtersFrom(resource, params)))
    .orderBy(...orderOf(resource))) as DbRow[]
  return rows.map((row) => serialize(resource, row))
}

async function findRow(rctx: ResourceContext, resource: Resource, id: string): Promise<DbRow> {
  if (!UUID.test(id)) throw ApiError.notFound()
  const [row] = (await rctx.db
    .select()
    .from(resource.table)
    .where(where(rctx, resource, eq(resource.id, id)))
    .limit(1)) as DbRow[]
  if (!row) throw ApiError.notFound()
  return row
}

function assertCanWrite(rctx: ResourceContext, resource: Resource, op: 'insert' | 'update' | 'delete') {
  if (!resource.canWrite(rctx, op)) throw ApiError.forbidden()
}

/** POST: um objeto ou uma lista (inserção em lote) */
async function insertRows(rctx: ResourceContext, resource: Resource, body: unknown) {
  assertCanWrite(rctx, resource, 'insert')
  const many = Array.isArray(body)
  const items = many ? body : [body]
  if (items.length === 0) return json([], 201)
  if (items.length > MAX_ROWS_PER_INSERT) throw ApiError.badRequest(`Envie no máximo ${MAX_ROWS_PER_INSERT} registros por vez.`)

  const createdKey = resource.managed.createdAt && keyOf(resource, resource.managed.createdAt)
  const viewedKey = resource.managed.viewedAt && keyOf(resource, resource.managed.viewedAt)
  const now = Date.now()
  const rows: DbRow[] = []
  for (const [index, item] of items.entries()) {
    let row = resource.insertSchema.parse(item)
    if (resource.prepareInsert) row = await resource.prepareInsert(rctx, row)
    // Datas definidas pelo servidor; +1 ms por item preserva a ordem de uma inserção em lote
    const stamp = new Date(now + index)
    if (createdKey) row[createdKey] = stamp
    if (viewedKey) row[viewedKey] = stamp
    rows.push(row)
  }

  const inserted = (await rctx.db.insert(resource.table).values(rows).returning()) as DbRow[]
  const out = inserted.map((row) => serialize(resource, row))
  return json(many ? out : out[0], 201)
}

async function updateRow(rctx: ResourceContext, resource: Resource, id: string, body: unknown) {
  assertCanWrite(rctx, resource, 'update')
  const existing = await findRow(rctx, resource, id)
  let patch = resource.updateSchema.parse(body)
  if (resource.guardUpdate) patch = await resource.guardUpdate(rctx, existing, patch)
  if (Object.keys(patch).length === 0) return json(serialize(resource, existing))
  const updatedKey = resource.managed.updatedAt && keyOf(resource, resource.managed.updatedAt)
  if (updatedKey) patch[updatedKey] = new Date()

  const [row] = (await rctx.db
    .update(resource.table)
    .set(patch)
    .where(where(rctx, resource, eq(resource.id, id)))
    .returning()) as DbRow[]
  if (!row) throw ApiError.notFound()
  await resource.afterUpdate?.(rctx, row, existing)
  return json(serialize(resource, row))
}

async function deleteRow(rctx: ResourceContext, resource: Resource, id: string) {
  assertCanWrite(rctx, resource, 'delete')
  const existing = await findRow(rctx, resource, id)
  await resource.guardDelete?.(rctx, existing)
  await rctx.db.delete(resource.table).where(where(rctx, resource, eq(resource.id, id)))
  return noContent()
}

/** DELETE /api/<recurso>?filtro=… — exige ao menos um filtro e aplica as regras em cada linha */
async function deleteWhere(rctx: ResourceContext, resource: Resource, params: URLSearchParams) {
  if (!resource.bulkDelete) throw methodNotAllowed()
  assertCanWrite(rctx, resource, 'delete')
  const filters = filtersFrom(resource, params)
  if (filters.length === 0) throw ApiError.badRequest('Informe ao menos um filtro para excluir em lote.')

  const rows = (await rctx.db
    .select()
    .from(resource.table)
    .where(where(rctx, resource, ...filters))) as DbRow[]
  if (rows.length === 0) return noContent()
  for (const row of rows) await resource.guardDelete?.(rctx, row)

  const ids = rows.map((row) => String(row.id))
  for (let i = 0; i < ids.length; i += 500) {
    await rctx.db.delete(resource.table).where(where(rctx, resource, inArray(resource.id, ids.slice(i, i + 500))))
  }
  return noContent()
}

/* ------------------------------------------------------------------ */
/* Lote de leituras (reduz o número de chamadas às funções)            */
/* ------------------------------------------------------------------ */

const batchSchema = z.object({
  requests: z
    .array(z.object({ path: z.string().min(1).max(2000) }))
    .min(1)
    .max(MAX_BATCH),
})

async function batch(ctx: RequestContext) {
  const { requests } = batchSchema.parse(await readJson(ctx.request))
  const rctx: ResourceContext = { db: ctx.db, session: requireApproved(await ctx.session()) }

  const results = await Promise.all(
    requests.map(async ({ path }) => {
      try {
        const sub = new URL(path.replace(/^\/?(api\/)?/, '/'), 'http://batch')
        const [name, id, ...extra] = sub.pathname.split('/').filter(Boolean).map(decodeSegment)
        const found = name ? resolveResource(name) : null
        if (!found || extra.length > 0) throw ApiError.notFound('Rota não encontrada.')
        const data = id
          ? serialize(found.resource, await findRow(rctx, found.resource, id))
          : await listRows(rctx, found.resource, sub.searchParams)
        return { status: 200, data }
      } catch (error) {
        const response = toErrorResponse(error)
        const body = (await response.json()) as { error: unknown }
        return { status: response.status, error: body.error }
      }
    }),
  )
  return json(results)
}

/* ------------------------------------------------------------------ */
/* Arquivos, exportação e saúde                                        */
/* ------------------------------------------------------------------ */

async function filesRoute(ctx: RequestContext, id: string | undefined) {
  const session = requireApproved(await ctx.session())
  if (id === undefined) {
    if (ctx.method === 'GET') return listFiles(ctx.db, ctx.url)
    if (ctx.method === 'POST') return uploadFile(ctx.db, session, ctx.request)
    throw methodNotAllowed()
  }
  if (!UUID.test(id)) throw ApiError.notFound('Arquivo não encontrado.')
  if (ctx.method === 'GET') {
    const [row] = await ctx.db.select().from(files).where(eq(files.id, id)).limit(1)
    if (!row) throw ApiError.notFound('Arquivo não encontrado.')
    return json(row)
  }
  if (ctx.method === 'DELETE') return deleteFile(ctx.db, session, id)
  throw methodNotAllowed()
}

/** Backup em JSON (somente administradores). Nunca inclui senhas nem sessões. */
async function exportAll(ctx: RequestContext) {
  const session = requireApproved(await ctx.session())
  if (!hasPermission(session.user.role, 'admin:access')) throw ApiError.forbidden()
  const rctx: ResourceContext = { db: ctx.db, session }
  // Favoritos, histórico e notificações pessoais seguem o escopo do próprio administrador
  const entries = await Promise.all(
    Object.entries(RESOURCES).map(async ([name, resource]) => [name, await listRows(rctx, resource, new URLSearchParams())] as const),
  )
  const fileRows = await ctx.db.select().from(files)
  return json({ ...Object.fromEntries(entries), files: fileRows })
}

async function health(ctx: RequestContext) {
  if (ctx.method !== 'GET') throw methodNotAllowed()
  try {
    await ctx.db.execute(sql`select 1`)
    return json({ status: 'ok', database: 'ok' })
  } catch (error) {
    console.error('[api] health: banco indisponível', error)
    return new Response(JSON.stringify({ data: { status: 'error', database: 'unavailable' } }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
}
