import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

/** Variáveis lidas apenas pelo servidor (nunca expostas ao navegador: não têm o prefixo VITE_) */
const SERVER_ENV = [
  'DATABASE_URL',
  'BLOB_READ_WRITE_TOKEN',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'SMTP_HOST',
  'SMTP_PORT',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'APP_URL',
  'RESEND_API_URL',
  'ADMIN_EMAIL',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
]
const MAX_DEV_BODY = 6 * 1024 * 1024

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL((req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value !== undefined) headers.set(key, value)
  }
  let body: Buffer | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += (chunk as Buffer).length
      if (size > MAX_DEV_BODY) throw new Error('Corpo da requisição muito grande')
      chunks.push(chunk as Buffer)
    }
    body = Buffer.concat(chunks)
  }
  return new Request(url, { method: req.method, headers, body })
}

async function sendWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) res.setHeader('set-cookie', cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
}

/** Serve /api/* no `npm run dev` com o mesmo código das Vercel Functions */
function apiDevServer(): Plugin {
  return {
    name: 'louvor-api-dev',
    apply: 'serve',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      for (const key of SERVER_ENV) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', (req, res, next) => {
        void (async () => {
          const { devHandler } = (await server.ssrLoadModule('/src/server/dev.ts')) as {
            devHandler: (request: Request) => Promise<Response>
          }
          await sendWebResponse(res, await devHandler(await toWebRequest(req)))
        })().catch((error: unknown) => {
          if (error instanceof Error) server.ssrFixStacktrace(error)
          next(error)
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevServer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: { ignored: ['**/.pglite/**'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@dnd-kit')) return 'dnd'
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react'
          }
          return undefined
        },
      },
    },
  },
})
