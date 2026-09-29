/**
 * Cliente HTTP da API (/api). O navegador só conversa com as Vercel Functions:
 * o banco, a DATABASE_URL e os tokens ficam apenas no servidor.
 * A sessão é um cookie httpOnly enviado automaticamente pelo navegador.
 */
import { DataError } from './db/types'

export const API_BASE = '/api'

export class ApiRequestError extends DataError {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, string[]>

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message)
    this.name = status === 404 ? 'NotFoundError' : 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, string[]> }
}

/* Sessão expirada: o AuthProvider escuta e volta para a tela de login */
const unauthorizedListeners = new Set<() => void>()
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}
export function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener())
}

/** Converte a resposta de erro da API em uma exceção com mensagem amigável */
export function toApiError(status: number, body: ErrorBody | null): ApiRequestError {
  const code = body?.error?.code ?? 'INTERNAL_ERROR'
  let message = body?.error?.message ?? (status >= 500 ? 'Erro no servidor. Tente novamente.' : 'Não foi possível concluir a operação.')
  const first = body?.error?.details && Object.values(body.error.details)[0]?.[0]
  if (first && !message.includes(first)) message = `${message} ${first}`
  if (status === 401) notifyUnauthorized()
  return new ApiRequestError(status, code, message, body?.error?.details)
}

/* Requisições interrompidas porque a página está sendo recarregada ou fechada não são erros */
let unloading = false
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    unloading = true
  })
  window.addEventListener('pageshow', () => {
    unloading = false
  })
}

export interface ApiRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Objeto (enviado como JSON) ou FormData (upload de arquivo) */
  body?: unknown
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  let body: BodyInit | undefined
  if (init.body instanceof FormData) body = init.body
  else if (init.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(init.body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\//, '')}`, {
      method: init.method ?? 'GET',
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    if (unloading) return new Promise<T>(() => {})
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Sem conexão com o servidor. Verifique sua internet.')
  }

  if (response.status === 204) return undefined as T
  let text: string
  try {
    text = await response.text()
  } catch {
    if (unloading) return new Promise<T>(() => {})
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'A conexão com o servidor foi interrompida. Tente novamente.')
  }
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    /* resposta não JSON (ex.: página de erro do provedor) */
  }
  if (!response.ok) throw toApiError(response.status, parsed as ErrorBody | null)
  return (parsed as { data: T } | null)?.data as T
}
