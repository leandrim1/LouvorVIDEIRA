/**
 * Vercel Function única da API. O rewrite em vercel.json envia /api/<caminho> para cá.
 * Roda no runtime Node.js (necessário para scrypt e para o driver do Neon).
 */
import { handleRequest } from '../src/server/router.js'

export const GET = handleRequest
export const POST = handleRequest
export const PATCH = handleRequest
export const PUT = handleRequest
export const DELETE = handleRequest
