import { existsSync, mkdirSync } from 'fs'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { ensurePortableLayout, getBrandingPath, getLogosPath } from './app-paths'
import { addSseClient } from './events'
import { registerRoutes } from './routes/index'
import { startFileWatcher } from './services/watcher.service'

function parseBind(bind: string): { host: string; port: number } {
  if (bind.startsWith('[')) {
    const end = bind.indexOf(']')
    const host = bind.slice(0, end + 1)
    const port = parseInt(bind.slice(end + 2), 10)
    return { host, port }
  }
  const colon = bind.lastIndexOf(':')
  if (colon === -1) {
    return { host: '127.0.0.1', port: parseInt(bind, 10) }
  }
  return { host: bind.slice(0, colon), port: parseInt(bind.slice(colon + 1), 10) }
}

export async function startServer(): Promise<void> {
  ensurePortableLayout()
  startFileWatcher()

  const bind = process.env.JANUS_API_BIND || '127.0.0.1:8005'
  const { host, port } = parseBind(bind)

  const app = Fastify({ logger: false })

  await app.register(cors, {
    origin: ['http://127.0.0.1:8006', 'http://localhost:8006']
  })

  const logosPath = getLogosPath()
  if (!existsSync(logosPath)) {
    mkdirSync(logosPath, { recursive: true })
  }
  await app.register(fastifyStatic, {
    root: logosPath,
    prefix: '/logos/',
    decorateReply: false
  })

  const brandingPath = getBrandingPath()
  if (!existsSync(brandingPath)) {
    mkdirSync(brandingPath, { recursive: true })
  }
  await app.register(fastifyStatic, {
    root: brandingPath,
    prefix: '/branding/',
    decorateReply: false
  })

  await registerRoutes(app)

  app.get('/api/health', async () => ({ ok: true }))

  app.get('/api/events', async (request, reply) => {
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    reply.raw.write(': connected\n\n')

    const client = {
      write: (chunk: string) => {
        reply.raw.write(chunk)
      },
      close: () => {
        reply.raw.end()
      }
    }
    const remove = addSseClient(client)

    request.raw.on('close', () => {
      remove()
    })
  })

  await app.listen({ host, port })
  console.log(`Janus API listening at http://${host}:${port}`)
}
