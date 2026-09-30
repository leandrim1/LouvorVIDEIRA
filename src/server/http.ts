/**
 * Respostas HTTP padronizadas da API.
 *   Sucesso: { data: ... }
 *   Erro:    { error: { code, message, details? } }
 * Mensagens de erro nunca incluem detalhes internos do banco.
 */
import { ZodError } from 'zod'
import { DatabaseNotConfiguredError } from '../db/index.js'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'TOO_MANY_REQUESTS'
  | 'EMAIL_NOT_CONFIGURED'
  | 'EMAIL_SEND_FAILED'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'VERIFICATION_PENDING'
  | 'PENDING_APPROVAL'
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_SUSPENDED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'OTP_SESSION_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_USED'
  | 'OTP_LOCKED'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly details?: Record<string, string[]>
  /** Segundos até poder tentar de novo (cabeçalho Retry-After) */
  retryAfter?: number

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static tooManyRequests(retryAfter: number, message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.') {
    const error = new ApiError(429, 'TOO_MANY_REQUESTS', message)
    error.retryAfter = retryAfter
    return error
  }

  static badRequest = (message: string, details?: Record<string, string[]>) => new ApiError(400, 'VALIDATION_ERROR', message, details)
  static unauthorized = (message = 'Faça login para continuar.') => new ApiError(401, 'UNAUTHORIZED', message)
  static forbidden = (message = 'Você não tem permissão para esta ação.') => new ApiError(403, 'FORBIDDEN', message)
  static notFound = (message = 'Registro não encontrado.') => new ApiError(404, 'NOT_FOUND', message)
  static conflict = (message: string) => new ApiError(409, 'CONFLICT', message)
}

export type HeaderList = Record<string, string> | [string, string][]

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

export function json(data: unknown, status = 200, headers?: HeaderList): Response {
  const res = new Response(JSON.stringify({ data }), { status, headers: JSON_HEADERS })
  if (headers) new Headers(headers).forEach((value, key) => res.headers.append(key, value))
  return res
}

export function noContent(headers?: HeaderList): Response {
  return new Response(null, { status: 204, headers })
}

function errorResponse(error: ApiError): Response {
  const body: { error: { code: ErrorCode; message: string; details?: Record<string, string[]>; retryAfter?: number } } = {
    error: { code: error.code, message: error.message },
  }
  if (error.details) body.error.details = error.details
  const headers: Record<string, string> = { ...JSON_HEADERS }
  if (error.retryAfter) {
    body.error.retryAfter = error.retryAfter
    headers['retry-after'] = String(error.retryAfter)
  }
  return new Response(JSON.stringify(body), { status: error.status, headers })
}

/** Código de erro do PostgreSQL (Neon, PGlite ou encapsulado pelo Drizzle) */
function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

/** Converte qualquer erro em uma resposta segura e consistente */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error)
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_'
      ;(details[key] ||= []).push(issue.message)
    }
    return errorResponse(ApiError.badRequest('Dados inválidos. Verifique os campos informados.', details))
  }
  if (error instanceof DatabaseNotConfiguredError) {
    return errorResponse(new ApiError(503, 'SERVICE_UNAVAILABLE', 'Banco de dados não configurado. Defina DATABASE_URL.'))
  }
  switch (pgErrorCode(error)) {
    // Tabela ou coluna inexistente: o banco está sem alguma migration
    case '42P01':
    case '42703':
      console.error('[api] banco desatualizado (migration pendente):', error)
      return errorResponse(
        new ApiError(503, 'SERVICE_UNAVAILABLE', 'O banco de dados está desatualizado. O administrador precisa aplicar as migrations pendentes.'),
      )
    case '23505':
      return errorResponse(ApiError.conflict('Já existe um registro com estes dados.'))
    case '23503':
      return errorResponse(ApiError.conflict('Registro relacionado inexistente ou ainda em uso.'))
    case '23502':
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
    case '22001':
      return errorResponse(ApiError.badRequest('Dados inválidos.'))
  }
  console.error('[api] erro inesperado:', error)
  return errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Erro interno do servidor. Tente novamente.'))
}

const MAX_JSON_BYTES = 1_000_000

/** Lê o corpo JSON com limite de tamanho */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) throw ApiError.badRequest('Envie os dados em JSON (Content-Type: application/json).')
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_JSON_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Conteúdo muito grande.')
  const text = await request.text()
  if (text.length > MAX_JSON_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Conteúdo muito grande.')
  try {
    return JSON.parse(text)
  } catch {
    throw ApiError.badRequest('JSON inválido.')
  }
}
