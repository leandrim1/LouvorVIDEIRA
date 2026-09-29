/**
 * Arquivos (fotos, capas, PDFs e áudios de estudo) no Vercel Blob.
 * O binário vai para o Blob; o PostgreSQL guarda apenas os metadados e a URL.
 */
import { randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { and, asc, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '../db/index.js'
import { files } from '../db/schema.js'
import { hasPermission } from '../lib/permissions.js'
import type { Session } from './auth.js'
import { ApiError, json, noContent } from './http.js'

/** Limite de corpo das Vercel Functions é 4,5 MB; deixamos margem para o multipart */
export const MAX_FILE_BYTES = 4 * 1024 * 1024

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))

/** Tipos aceitos, identificados pelo conteúdo (assinatura), nunca pelo que o navegador declara */
const FILE_TYPES: { contentType: string; ext: string; matches: (b: Uint8Array) => boolean }[] = [
  { contentType: 'image/jpeg', ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { contentType: 'image/png', ext: 'png', matches: (b) => ascii(b, 1, 4) === 'PNG' && b[0] === 0x89 },
  { contentType: 'image/webp', ext: 'webp', matches: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  { contentType: 'image/gif', ext: 'gif', matches: (b) => ['GIF87a', 'GIF89a'].includes(ascii(b, 0, 6)) },
  { contentType: 'application/pdf', ext: 'pdf', matches: (b) => ascii(b, 0, 5) === '%PDF-' },
  { contentType: 'audio/mpeg', ext: 'mp3', matches: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { contentType: 'audio/mp4', ext: 'm4a', matches: (b) => ascii(b, 4, 8) === 'ftyp' && ascii(b, 8, 11) === 'M4A' },
]

const IMAGE_KINDS = new Set(['cover', 'photo'])

const uploadFields = z.object({
  kind: z.enum(files.kind.enumValues).default('other'),
  songId: z.uuid().nullable().default(null),
  memberId: z.uuid().nullable().default(null),
})

const listFilters = z.object({
  songId: z.uuid().optional(),
  memberId: z.uuid().optional(),
  kind: z.enum(files.kind.enumValues).optional(),
  url: z.string().max(2048).optional(),
})

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

function requireBlob() {
  if (!blobConfigured()) {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Armazenamento de arquivos não configurado. Conecte o Vercel Blob ao projeto.')
  }
}

/** Fotos de integrantes exigem gerenciar a equipe; capas e arquivos de estudo exigem editar músicas */
function canUpload(session: Session, kind: string, memberId: string | null) {
  return hasPermission(session.user.role, kind === 'photo' || memberId ? 'members:write' : 'songs:write')
}

function safeName(name: string) {
  // Remove barras e caracteres de controle
  const clean = [...name.normalize('NFC')].filter((ch) => ch.charCodeAt(0) >= 32 && ch !== '/' && ch !== '\\').join('')
  return clean.trim().slice(0, 200)
}

/** GET /api/files?songId=…&memberId=…&kind=…&url=… */
export async function listFiles(db: Database, url: URL) {
  const params = Object.fromEntries([...url.searchParams].filter(([key]) => key !== 'path'))
  const filters = listFilters.parse(params)
  const where: SQL[] = []
  if (filters.songId) where.push(eq(files.songId, filters.songId))
  if (filters.memberId) where.push(eq(files.memberId, filters.memberId))
  if (filters.kind) where.push(eq(files.kind, filters.kind))
  if (filters.url) where.push(eq(files.url, filters.url))
  return json(await db.select().from(files).where(and(...where)).orderBy(asc(files.createdAt), asc(files.id)))
}

/** POST /api/files (multipart/form-data: file, kind, songId?, memberId?) */
export async function uploadFile(db: Database, session: Session, request: Request) {
  const type = request.headers.get('content-type') ?? ''
  if (!type.includes('multipart/form-data')) throw ApiError.badRequest('Envie o arquivo como multipart/form-data.')
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_FILE_BYTES + 64 * 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Arquivo muito grande (máximo de 4 MB).')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw ApiError.badRequest('Formulário de envio inválido.')
  }
  const fields = uploadFields.parse({
    kind: form.get('kind') ?? undefined,
    songId: form.get('songId') || null,
    memberId: form.get('memberId') || null,
  })
  if (!canUpload(session, fields.kind, fields.memberId)) throw ApiError.forbidden()

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) throw ApiError.badRequest('Selecione um arquivo.', { file: ['Obrigatório'] })
  if (file.size > MAX_FILE_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Arquivo muito grande (máximo de 4 MB).')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = FILE_TYPES.find((t) => t.matches(bytes))
  if (!detected) throw ApiError.badRequest('Tipo de arquivo não permitido. Envie JPG, PNG, WEBP, GIF, PDF, MP3 ou M4A.')
  if (IMAGE_KINDS.has(fields.kind) && !detected.contentType.startsWith('image/')) {
    throw ApiError.badRequest('Capas e fotos precisam ser imagens.')
  }

  requireBlob()
  // Nome no Blob gerado pelo servidor: nunca usamos o nome enviado pelo usuário no caminho
  const blob = await put(`${fields.kind}/${randomUUID()}.${detected.ext}`, Buffer.from(bytes), {
    access: 'public',
    contentType: detected.contentType,
    cacheControlMaxAge: 31_536_000,
  })

  try {
    const [row] = await db
      .insert(files)
      .values({
        name: safeName(file.name),
        url: blob.url,
        pathname: blob.pathname,
        contentType: detected.contentType,
        size: bytes.byteLength,
        kind: fields.kind,
        songId: fields.songId,
        memberId: fields.memberId,
        uploadedBy: session.user.id,
      })
      .returning()
    return json(row, 201)
  } catch (error) {
    // Não deixa arquivo órfão no Blob se o registro falhar (ex.: música inexistente)
    await del(blob.url).catch(() => undefined)
    throw error
  }
}

/** DELETE /api/files/:id — quem enviou ou líderes/administradores */
export async function deleteFile(db: Database, session: Session, id: string) {
  const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1)
  if (!row) throw ApiError.notFound('Arquivo não encontrado.')
  const isLeader = hasPermission(session.user.role, 'songs:write') || hasPermission(session.user.role, 'members:write')
  if (!isLeader && row.uploadedBy !== session.user.id) throw ApiError.forbidden()
  if (blobConfigured()) await del(row.url)
  await db.delete(files).where(eq(files.id, id))
  return noContent()
}

