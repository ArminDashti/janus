// Janus.exe CLI entry (bundled into a Node SEA by build-janus-exe.ps1).
//
// Implements the local-install command surface:
//   janus doctor | status | help
//   janus service start|stop|status|restart [--port=N]
//   janus local-webui run [--port=N] [--no-open]
//   janus __serve --port=N          (internal: background server process)
//
// The server is composed here from janus-api's exported pieces (registerRoutes,
// addSseClient, ensurePortableLayout, startFileWatcher) so that the WebUI can be
// served from the SAME Fastify instance (same-origin, required because the port
// is random per start). janus-api sources are not modified.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, appendFileSync, unlinkSync, openSync, closeSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { performance } from 'node:perf_hooks'
import { format } from 'node:util'
import { createServer } from 'node:net'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerRoutes } from '../janus-api/src/routes/index'
import { addSseClient } from '../janus-api/src/events'
import { ensurePortableLayout } from '../janus-api/src/app-paths'
import { startFileWatcher } from '../janus-api/src/services/watcher.service'

// ---------------------------------------------------------------------------
// Paths & environment
// ---------------------------------------------------------------------------

// SEA production: the install dir is where Janus.exe lives. Dev runs (node bundle.cjs)
// can override via JANUS_INSTALL_DIR; otherwise fall back to dirname(process.execPath).
const installDir = process.env.JANUS_INSTALL_DIR?.trim() || dirname(process.execPath)
const logsRoot = join(installDir, 'logs')
const settingsPath = join(installDir, 'settings.json')

// Everything under janus-api resolves settings/data from the install dir.
process.env.JANUS_APP_ROOT = process.env.JANUS_APP_ROOT || installDir

const SAFE_PORT_MIN = 49152
const SAFE_PORT_MAX = 65535
const AUTO_PORT_ATTEMPTS = 5

const SERVER_FLAG = '__serve'
const SERVER_ARG = `--port=`

// ---------------------------------------------------------------------------
// Logging -> logs/{infos,warnings,errors}/YYYY-MM-DD.txt (daily files)
// ---------------------------------------------------------------------------

type LogBucket = 'infos' | 'warnings' | 'errors'

function writeLog(bucket: LogBucket, message: string): void {
  try {
    const dir = join(logsRoot, bucket)
    mkdirSync(dir, { recursive: true })
    const day = todayLocal()
    appendFileSync(join(dir, `${day}.txt`), `${new Date().toISOString()} ${message}\n`, 'utf-8')
  } catch {
    // Logging must never take the process down.
  }
}

// Local calendar day — matches install-local.ps1's Get-Date naming and the spec's
// per-day examples (infos/2026-09-07.txt), not the UTC day (differs before +03:30 midnight).
function todayLocal(): string {
  const now = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

// Touch today's file in every bucket so each active day has its full log set
// (infos/…, warnings/…, errors/…), even before the first warning or error occurs.
function ensureDailyLogs(): void {
  const day = todayLocal()
  for (const bucket of ['infos', 'warnings', 'errors'] as LogBucket[]) {
    try {
      const dir = join(logsRoot, bucket)
      mkdirSync(dir, { recursive: true })
      closeSync(openSync(join(dir, `${day}.txt`), 'a'))
    } catch {
      // Logging must never take the process down.
    }
  }
}

let consoleInstalled = false
function installConsoleHooks(echo: boolean): void {
  if (consoleInstalled) return
  consoleInstalled = true
  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  }
  console.log = (...args: unknown[]): void => {
    writeLog('infos', format(...args))
    if (echo) orig.log(...args)
  }
  console.info = (...args: unknown[]): void => {
    writeLog('infos', format(...args))
    if (echo) orig.info(...args)
  }
  console.warn = (...args: unknown[]): void => {
    writeLog('warnings', format(...args))
    if (echo) orig.warn(...args)
  }
  console.error = (...args: unknown[]): void => {
    writeLog('errors', format(...args))
    if (echo) orig.error(...args)
  }
  process.on('uncaughtException', (err) => {
    writeLog('errors', `uncaughtException: ${err && err.stack ? err.stack : err}`)
    if (echo) orig.error(err)
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    writeLog('errors', `unhandledRejection: ${format(reason)}`)
  })
}

// ---------------------------------------------------------------------------
// WebUI assets: embedded SEA assets in production, dist/ on disk in dev.
// ---------------------------------------------------------------------------

interface SeaModule {
  isSea(): boolean
  getAsset(key: string): unknown
}

let seaMod: SeaModule | null = null
try {
  const m = require('node:sea') as SeaModule
  if (m && typeof m.isSea === 'function' && m.isSea()) seaMod = m
} catch {
  seaMod = null
}

function devDistDir(): string | null {
  const candidates = [
    process.env.JANUS_WEBUI_DIST,
    join(process.cwd(), 'janus-webui', 'dist'),
    join(process.cwd(), 'dist')
  ].filter((c): c is string => Boolean(c))
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) return c
  }
  return null
}

function getWebuiAsset(relPosix: string): Buffer | null {
  if (seaMod) {
    try {
      const a = seaMod.getAsset(`webui/${relPosix}`) as ArrayBuffer | string | undefined
      if (a === undefined || a === null) return null
      if (typeof a === 'string') return Buffer.from(a, 'utf-8')
      return Buffer.from(a as ArrayBuffer)
    } catch {
      return null
    }
  }
  const dist = devDistDir()
  if (!dist) return null
  // Normalize and refuse traversal.
  const rel = normalize(relPosix).replace(/^([/\\])+/, '')
  if (rel.includes('..')) return null
  const full = join(dist, rel)
  if (!full.startsWith(dist + sep) && full !== dist) return null
  try {
    return readFileSync(full)
  } catch {
    return null
  }
}

function contentTypeFor(p: string): string {
  switch (extname(p).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js':
    case '.mjs': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.webmanifest': return 'application/manifest+json; charset=utf-8'
    case '.map': return 'application/json; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.ico': return 'image/x-icon'
    case '.gif': return 'image/gif'
    case '.woff2': return 'font/woff2'
    case '.woff': return 'font/woff'
    case '.ttf': return 'font/ttf'
    case '.txt': return 'text/plain; charset=utf-8'
    case '.wasm': return 'application/wasm'
    default: return 'application/octet-stream'
  }
}

function cacheControlFor(p: string): string {
  if (p.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  return 'no-cache'
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

function bindTest(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer()
    s.once('error', () => resolve(false))
    s.once('listening', () => s.close(() => resolve(true)))
    s.listen(port, '127.0.0.1')
  })
}

async function pickRandomSafePort(): Promise<number> {
  const span = SAFE_PORT_MAX - SAFE_PORT_MIN + 1
  for (let i = 0; i < 50; i++) {
    const port = SAFE_PORT_MIN + Math.floor(Math.random() * span)
    if (await bindTest(port)) return port
  }
  throw new Error(`Could not find a free port in ${SAFE_PORT_MIN}-${SAFE_PORT_MAX}`)
}

// ---------------------------------------------------------------------------
// Background process discovery (the "service" is a detached Janus.exe process)
// ---------------------------------------------------------------------------

interface Instance {
  pid: number
  commandLine: string
  port: number | null
  mode: 'serve' | 'webui' | 'unknown'
}

const PS_JSON_FLAGS = ['-NoProfile', '-NonInteractive', '-Command']

function findJanusInstances(match?: 'serve' | 'any'): Instance[] {
  const exePath = process.execPath.replace(/'/g, "''")
  // Only ever target THIS install's exe (there may be stray Janus.exe copies elsewhere).
  const script =
    `$p = Get-CimInstance Win32_Process -Filter "Name='Janus.exe'" -ErrorAction SilentlyContinue | ` +
    `Where-Object { $_.ExecutablePath -and $_.ExecutablePath -ieq '${exePath}' }; ` +
    `if ($p) { $p | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress }`
  const res = spawnSync('powershell.exe', [...PS_JSON_FLAGS, script], {
    encoding: 'utf-8',
    windowsHide: true
  })
  if (res.status !== 0 || !res.stdout || !res.stdout.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(res.stdout.trim())
  } catch {
    return []
  }
  const list = Array.isArray(parsed) ? parsed : [parsed]
  const out: Instance[] = []
  for (const item of list) {
    const rec = item as { ProcessId?: number; CommandLine?: string }
    if (typeof rec.ProcessId !== 'number') continue
    const commandLine = rec.CommandLine || ''
    const mode: Instance['mode'] = commandLine.includes(SERVER_FLAG)
      ? 'serve'
      : commandLine.includes('local-webui')
        ? 'webui'
        : 'unknown'
    const pm = /--port=(\d+)/.exec(commandLine)
    out.push({ pid: rec.ProcessId, commandLine, port: pm ? parseInt(pm[1], 10) : null, mode })
  }
  if (match === 'serve') return out.filter((i) => i.mode === 'serve')
  return out
}

function killInstance(pid: number): void {
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
}

function stopAllInstances(match?: 'serve' | 'any'): number {
  const found = findJanusInstances(match)
  for (const i of found) killInstance(i.pid)
  if (found.length > 0) {
    const deadline = performance.now() + 5000
    while (performance.now() < deadline) {
      if (findJanusInstances(match).length === 0) break
      spawnSync('ping', ['-n', '2', '127.0.0.1'], { windowsHide: true, stdio: 'ignore' })
    }
  }
  return found.length
}

// ---------------------------------------------------------------------------
// Health probe
// ---------------------------------------------------------------------------

async function probeHealth(port: number, timeoutMs = 1200): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: boolean }
    return body && body.ok === true
  } catch {
    return false
  }
}

async function waitUntilHealthy(port: number, totalMs: number): Promise<boolean> {
  const deadline = performance.now() + totalMs
  while (performance.now() < deadline) {
    if (await probeHealth(port)) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

function tailErrors(n = 8): string {
  try {
    const day = new Date().toISOString().slice(0, 10)
    const p = join(logsRoot, 'errors', `${day}.txt`)
    const lines = readFileSync(p, 'utf-8').split(/\r?\n/).filter(Boolean)
    return lines.slice(-n).join('\n')
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Server: API + WebUI on ONE port (same origin)
// ---------------------------------------------------------------------------

async function serve(port: number): Promise<void> {
  installConsoleHooks(true)
  process.env.JANUS_API_BIND = `127.0.0.1:${port}`

  ensurePortableLayout()
  startFileWatcher()

  const app = Fastify({ logger: false })

  // Same effective behavior as janus-api's server.ts CORS config (allow all).
  await app.register(cors, { origin: true, credentials: true })

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
    const client = { write: (chunk: string): void => { reply.raw.write(chunk) }, close: (): void => { reply.raw.end() } }
    const remove = addSseClient(client)
    request.raw.on('close', () => { remove() })
  })

  // Static WebUI + SPA fallback.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      void reply.code(404).send({ error: 'Not found' })
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      void reply.code(404).send({ error: 'Not found' })
      return
    }
    let rel = request.url.split('?')[0]
    try {
      rel = decodeURIComponent(rel)
    } catch {
      /* keep raw */
    }
    if (rel.includes('..')) {
      void reply.code(400).send({ error: 'Bad path' })
      return
    }
    if (rel === '/' || rel === '') rel = '/index.html'

    let body = rel.endsWith('/') ? null : getWebuiAsset(rel.replace(/^\/+/, ''))
    let served = rel
    if (!body && !extname(rel)) {
      // SPA fallback for extension-less routes.
      body = getWebuiAsset('index.html')
      served = '/index.html'
    }
    if (!body) {
      void reply.code(404).send({ error: 'Not found' })
      return
    }
    void reply
      .code(200)
      .header('Content-Type', contentTypeFor(served))
      .header('Cache-Control', cacheControlFor(served))
      .send(body)
  })

  try {
    await app.listen({ host: '127.0.0.1', port })
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e && e.code === 'EADDRINUSE') {
      // Logged via console hook (-> logs/errors) and rethrown so callers decide:
      // foreground retry loop picks a new port; the detached child exits(1).
      console.error(`Port ${port} is already in use.`)
    }
    throw err
  }

  const url = `http://127.0.0.1:${port}/`
  console.log(`Janus running at ${url} (pid ${process.pid})`)

  const shutdown = (): void => {
    console.log('Server stopping (signal)')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

const USAGE = `Janus local CLI

Usage:
  janus doctor                          Check installation health
  janus status                          Show install and service status
  janus help                            Show this help
  janus service start [--port=N]        Start the background service
                                        (default: random free port in ${SAFE_PORT_MIN}-${SAFE_PORT_MAX})
  janus service stop                    Stop the background service
  janus service status                  Show background service status
  janus service restart [--port=N]      Restart the background service
                                        (default: a NEW random free port)
  janus local-webui run [--port=N] [--no-open]
                                        Run API + WebUI in the foreground and open
                                        the browser (if the background service is
                                        already running, opens its URL instead)
`

function cmdHelp(): number {
  console.log(USAGE)
  return 0
}

function parsePortFlag(argv: string[]): { port: number | null; rest: string[]; explicit: boolean } {
  const rest: string[] = []
  let port: number | null = null
  let explicit = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    let m: RegExpExecArray | null = null
    if ((m = /^--port=(\d+)$/.exec(a))) {
      port = parseInt(m[1], 10)
      explicit = true
    } else if (a === '--port' && argv[i + 1] !== undefined && /^\d+$/.test(argv[i + 1])) {
      port = parseInt(argv[i + 1], 10)
      explicit = true
      i++
    } else {
      rest.push(a)
    }
  }
  if (port !== null && (port < 1 || port > 65535)) {
    fail(`Invalid port: ${port}`)
  }
  return { port, rest, explicit }
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

async function cmdServiceStart(argv: string[]): Promise<number> {
  const { port, explicit } = parsePortFlag(argv)
  const existing = findJanusInstances('serve')
  if (existing.length > 0) {
    const e = existing[0]
    const url = e.port ? `http://127.0.0.1:${e.port}/` : 'unknown port'
    console.log(`Service already running (pid ${e.pid}) at ${url}`)
    return 0
  }

  const attempts = explicit ? 1 : AUTO_PORT_ATTEMPTS
  for (let attempt = 0; attempt < attempts; attempt++) {
    let chosen: number
    if (explicit && port !== null) {
      if (!(await bindTest(port))) {
        fail(`Port ${port} is already in use.`)
      }
      chosen = port
    } else {
      chosen = await pickRandomSafePort()
    }

    const child = spawn(process.execPath, [SERVER_FLAG, `${SERVER_ARG}${chosen}`], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env }
    })
    child.unref()

    if (await waitUntilHealthy(chosen, 6000)) {
      console.log(`Service started (pid ${child.pid}) at http://127.0.0.1:${chosen}/`)
      return 0
    }

    // Health wait failed: is the child alive?
    const alive = findJanusInstances('serve').some((i) => i.port === chosen)
    if (alive) {
      // Bind race or slow start; kill and retry with a fresh port (auto mode only).
      stopAllInstances('serve')
      if (explicit) break
      continue
    }
    if (explicit) break
    // Child died (likely port stolen between test and bind); try another port.
    console.warn(`Server on port ${chosen} did not come up; retrying with a new port`)
  }

  const tail = tailErrors()
  console.error('Service failed to start.')
  if (tail) console.error(`Recent errors (logs/errors/${new Date().toISOString().slice(0, 10)}.txt):\n${tail}`)
  return 1
}

function cmdServiceStop(): number {
  const n = stopAllInstances('serve')
  if (n === 0) {
    console.log('Service is not running.')
    return 0
  }
  console.log(`Service stopped (killed ${n} process${n === 1 ? '' : 'es'}).`)
  return 0
}

async function cmdServiceStatus(): Promise<number> {
  const found = findJanusInstances('serve')
  if (found.length === 0) {
    console.log('Service: stopped')
    return 1
  }
  const e = found[0]
  const healthy = e.port !== null ? await probeHealth(e.port) : false
  console.log(`Service: running`)
  console.log(`  PID:    ${e.pid}`)
  console.log(`  Port:   ${e.port ?? 'unknown'}`)
  console.log(`  Health: ${healthy ? 'ok' : e.port === null ? 'unknown' : 'UNREACHABLE'}`)
  if (e.port) console.log(`  URL:    http://127.0.0.1:${e.port}/`)
  return healthy ? 0 : 1
}

async function cmdServiceRestart(argv: string[]): Promise<number> {
  const { port, explicit } = parsePortFlag(argv)
  stopAllInstances('serve')
  const argv2: string[] = []
  if (explicit && port !== null) argv2.push(`--port=${port}`)
  // No explicit port: start picks a NEW random port (per spec).
  return cmdServiceStart(argv2)
}

async function cmdLocalWebui(argv: string[]): Promise<number> {
  const sub = argv[0]
  if (sub !== 'run') {
    console.error(`Unknown local-webui command: ${sub || '(missing)'}\n\n${USAGE}`)
    return 1
  }
  const { port, explicit } = parsePortFlag(argv.slice(1))
  const noOpen = argv.slice(1).some((a) => a === '--no-open')

  // If a background service is already up, just open its URL.
  const bg = findJanusInstances('serve')
  if (bg.length > 0 && bg[0].port !== null) {
    const url = `http://127.0.0.1:${bg[0].port}/`
    console.log(`Background service already running at ${url}`)
    if (!noOpen) openBrowser(url)
    return 0
  }

  const attempts = explicit ? 1 : AUTO_PORT_ATTEMPTS
  for (let attempt = 0; attempt < attempts; attempt++) {
    const chosen = (explicit && port !== null) ? port : await pickRandomSafePort()
    if (explicit && !(await bindTest(chosen))) fail(`Port ${chosen} is already in use.`)
    try {
      await serve(chosen)
      const url = `http://127.0.0.1:${chosen}/`
      if (!noOpen) openBrowser(url)
      console.log('Press Ctrl+C to stop.')
      // Keep the process alive until signal; serve() registered handlers.
      await new Promise<void>(() => { /* run until SIGINT/SIGTERM */ })
      return 0
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e && e.code === 'EADDRINUSE' && !explicit) continue
      throw err
    }
  }
  console.error('Could not start the WebUI server.')
  return 1
}

function openBrowser(url: string): void {
  try {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.unref()
  } catch (err) {
    console.warn(`could not open browser: ${format(err)}`)
  }
}

async function cmdStatus(): Promise<number> {
  console.log(`Install dir: ${installDir}${process.env.JANUS_INSTALL_DIR?.trim() ? '  [JANUS_INSTALL_DIR override]' : ''}`)
  console.log(`Exe:         ${process.execPath}`)
  try {
    const st = statSync(process.execPath)
    console.log(`             ${(st.size / (1024 * 1024)).toFixed(1)} MB, built ${st.mtime.toISOString()}`)
  } catch {
    /* ignore */
  }

  // settings.json (raw read — no side effects)
  if (existsSync(settingsPath)) {
    try {
      const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8')) as unknown
      const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed as object).length : 0
      console.log(`Settings:    ${settingsPath} (ok, ${keys} top-level keys)`)
    } catch (err) {
      console.log(`Settings:    ${settingsPath} (INVALID: ${format(err)})`)
    }
  } else {
    console.log(`Settings:    ${settingsPath} (missing — created on first server start)`)
  }

  const found = findJanusInstances('serve')
  if (found.length === 0) {
    console.log('Service:     stopped')
  } else {
    const e = found[0]
    const healthy = e.port !== null ? await probeHealth(e.port) : false
    console.log(`Service:     running (pid ${e.pid}, port ${e.port ?? '?'}, health ${healthy ? 'ok' : 'unreachable'})`)
    if (e.port) console.log(`WebUI:       http://127.0.0.1:${e.port}/`)
  }

  const legacy = spawnSync('sc.exe', ['query', 'janus'], { windowsHide: true, stdio: 'ignore' })
  if (legacy.status === 0) {
    console.log('Legacy:      old Windows service "janus" detected (run scripts\\remove-local.ps1 to remove it)')
  }
  return 0
}

interface CheckResult {
  state: 'OK' | 'WARN' | 'FAIL'
  name: string
  detail: string
}

async function cmdDoctor(): Promise<number> {
  const checks: CheckResult[] = []
  const ok = (name: string, detail: string): void => { checks.push({ state: 'OK', name, detail }) }
  const warn = (name: string, detail: string): void => { checks.push({ state: 'WARN', name, detail }) }
  const bad = (name: string, detail: string): void => { checks.push({ state: 'FAIL', name, detail }) }

  // 1. Executable present (we are running from it).
  if (process.execPath.toLowerCase().endsWith('janus.exe')) {
    ok('exe', process.execPath)
  } else {
    bad('exe', `running from ${process.execPath}, expected Janus.exe`)
  }

  // 2. settings.json parses.
  if (existsSync(settingsPath)) {
    try {
      JSON.parse(readFileSync(settingsPath, 'utf-8'))
      ok('settings.json', 'present and valid JSON')
    } catch (err) {
      bad('settings.json', `present but INVALID: ${format(err)}`)
    }
  } else {
    warn('settings.json', 'missing (will be created on first server start)')
  }

  // 3. Log dirs exist and are writable.
  let logsOk = true
  for (const b of ['infos', 'warnings', 'errors'] as LogBucket[]) {
    try {
      const dir = join(logsRoot, b)
      mkdirSync(dir, { recursive: true })
      appendFileSync(join(dir, `.probe`), '')
      try { unlinkSync(join(dir, `.probe`)) } catch { /* ignore */ }
    } catch (err) {
      logsOk = false
      bad('logs', `${b}: ${format(err)}`)
      break
    }
  }
  if (logsOk) ok('logs', `${logsRoot}\\{infos,warnings,errors} writable`)

  // 4. Install dir on PATH (current session).
  const pathEntries = (process.env.Path || process.env.PATH || '').split(';').map((p) => p.trim().replace(/\\+$/, '').toLowerCase())
  if (pathEntries.includes(installDir.replace(/\\+$/, '').toLowerCase())) {
    ok('PATH', 'install dir is on PATH')
  } else {
    const envOverride = process.env.JANUS_INSTALL_DIR?.trim()
    warn('PATH', `install dir NOT on PATH — open a new terminal (or re-run install-local.ps1)${envOverride ? ` [JANUS_INSTALL_DIR override active: ${envOverride}]` : ''}`)
  }

  // 5. WebUI assets embedded.
  const idx = getWebuiAsset('index.html')
  if (idx && idx.length > 0) {
    ok('webui', `embedded index.html (${idx.length} bytes)${seaMod ? '' : ' [dev mode: reading dist from disk]'}`)
  } else {
    bad('webui', 'embedded index.html not found in exe')
  }

  // 6. git on PATH (needed by scans via simple-git).
  const git = spawnSync('git', ['--version'], { windowsHide: true, stdio: 'ignore' })
  if (git.status === 0) ok('git', 'available')
  else warn('git', 'not found on PATH — resource scans that use git will fail')

  // 7. Port range usable.
  let portOk = false
  for (let i = 0; i < 10 && !portOk; i++) {
    portOk = await bindTest(SAFE_PORT_MIN + Math.floor(Math.random() * (SAFE_PORT_MAX - SAFE_PORT_MIN + 1)))
  }
  if (portOk) ok('ports', `can bind in ${SAFE_PORT_MIN}-${SAFE_PORT_MAX}`)
  else bad('ports', `cannot bind any port in ${SAFE_PORT_MIN}-${SAFE_PORT_MAX}`)

  // 8. Service state.
  const found = findJanusInstances('serve')
  if (found.length === 0) {
    warn('service', 'stopped (janus service start to run it)')
  } else {
    const e = found[0]
    const healthy = e.port !== null ? await probeHealth(e.port) : false
    if (healthy) ok('service', `running (pid ${e.pid}, port ${e.port})`)
    else bad('service', `running (pid ${e.pid}) but health check failed on port ${e.port}`)
  }

  // 9. Legacy Windows services.
  const legacy = spawnSync('sc.exe', ['query', 'janus'], { windowsHide: true, stdio: 'ignore' })
  if (legacy.status === 0) {
    warn('legacy', 'old Windows services "janus"/"janus-webui" still installed — run scripts\\remove-local.ps1 to remove them')
  }

  // Print report.
  for (const c of checks) {
    const tag = c.state === 'OK' ? '[OK]  ' : c.state === 'WARN' ? '[WARN]' : '[FAIL]'
    console.log(`${tag} ${c.name.padEnd(14)} ${c.detail}`)
  }
  const failed = checks.filter((c) => c.state === 'FAIL').length
  const warned = checks.filter((c) => c.state === 'WARN').length
  console.log(`\n${checks.length} checks: ${checks.length - failed - warned} ok, ${warned} warnings, ${failed} failed`)
  return failed > 0 ? 1 : 0
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Every command's console output is mirrored into the daily log files.
  installConsoleHooks(true)
  ensureDailyLogs()
  const argv = process.argv.slice(2)
  const cmd = argv[0]

  // Internal background-server mode.
  if (cmd === SERVER_FLAG) {
    const { port } = parsePortFlag(argv.slice(1))
    if (port === null) fail(`${SERVER_FLAG} requires --port=N`)
    await serve(port)
    return
  }

  switch (cmd) {
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      process.exit(cmdHelp())
      break
    case 'doctor':
      process.exit(await cmdDoctor())
      break
    case 'status':
      process.exit(await cmdStatus())
      break
    case 'service': {
      const sub = argv[1]
      if (sub === 'start') process.exit(await cmdServiceStart(argv.slice(2)))
      else if (sub === 'stop') process.exit(cmdServiceStop())
      else if (sub === 'status') process.exit(await cmdServiceStatus())
      else if (sub === 'restart') process.exit(await cmdServiceRestart(argv.slice(2)))
      else {
        console.error(`Unknown service command: ${sub || '(missing)'}\n\n${USAGE}`)
        process.exit(1)
      }
      break
    }
    case 'local-webui':
      process.exit(await cmdLocalWebui(argv.slice(1)))
      break
    default:
      console.error(`Unknown command: ${cmd}\n\n${USAGE}`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : format(err))
  process.exit(1)
})
