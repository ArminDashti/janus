import { spawn } from 'child_process'
import type { McpResource, McpTool } from '../shared/types'
import { agentDebugLog } from './debug-log'

const PROBE_TIMEOUT_MS = 5000
const MAX_CONCURRENT = 3
/** Fresh probe results are reused for this long so page revisits don't respawn servers. */
const PROBE_CACHE_TTL_MS = 5 * 60 * 1000

interface ProbeResult {
  status: McpResource['status']
  tools: McpTool[]
  error?: string
}

/** name+params -> { at, result }; identical concurrent probes share one promise. */
const probeCache = new Map<string, { at: number; result: ProbeResult }>()
const inflight = new Map<string, Promise<ProbeResult>>()

function paramsKey(name: string, params: Record<string, unknown>): string {
  return `${name}\u0000${JSON.stringify(params)}`
}

function hasStdioTransport(params: Record<string, unknown>): boolean {
  return typeof params.command === 'string' && params.command.length > 0
}

function sendJsonRpc(
  proc: ReturnType<typeof spawn>,
  id: number,
  method: string,
  params: Record<string, unknown>
): void {
  const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
  proc.stdin?.write(`${payload}\n`)
}

async function probeStdioMcp(params: Record<string, unknown>): Promise<ProbeResult> {
  const command = String(params.command)
  const args = Array.isArray(params.args) ? params.args.map(String) : []
  const env = params.env && typeof params.env === 'object'
    ? { ...process.env, ...(params.env as Record<string, string>) }
    : process.env

  return new Promise((resolve) => {
    let settled = false
    let buffer = ''
    let stderrTail = ''
    let initDone = false
    const tools: McpTool[] = []

    const stderrSuffix = (): string =>
      stderrTail.trim() ? ` — stderr: ${stderrTail.trim()}` : ''

    const finish = (result: ProbeResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      proc.kill()
      resolve(result)
    }

    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: process.platform === 'win32',
      // Without this, every probe flashes a console window on Windows.
      windowsHide: true
    })

    const timer = setTimeout(() => {
      finish({
        status: 'disconnected',
        tools: [],
        error: `Timed out after ${PROBE_TIMEOUT_MS}ms waiting for MCP response${stderrSuffix()}`
      })
    }, PROBE_TIMEOUT_MS)

    proc.on('error', (err) => finish({ status: 'error', tools: [], error: err.message }))

    proc.on('exit', (code, signal) => {
      finish({
        status: 'disconnected',
        tools: [],
        error:
          `Process exited before responding (code ${code ?? 'null'}` +
          `${signal ? `, signal ${signal}` : ''})${stderrSuffix()}`
      })
    })

    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed) as {
            id?: number
            result?: { tools?: Array<{ name?: string; description?: string }> }
            error?: { code?: number; message?: string }
          }
          if (msg.error) {
            const detail = msg.error.message ?? JSON.stringify(msg.error)
            const code = msg.error.code !== undefined ? ` (${msg.error.code})` : ''
            finish({ status: 'error', tools: [], error: `MCP error${code}: ${detail}` })
            return
          }
          if (msg.id === 1 && !initDone) {
            initDone = true
            sendJsonRpc(proc, 2, 'tools/list', {})
          }
          if (msg.id === 2) {
            for (const tool of msg.result?.tools ?? []) {
              if (tool.name) tools.push({ name: tool.name, description: tool.description })
            }
            finish({ status: 'connected', tools })
          }
        } catch {
          // ignore non-json lines
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Keep a bounded tail so probe failures can surface why the server died
      stderrTail = (stderrTail + chunk.toString()).slice(-500)
    })

    sendJsonRpc(proc, 1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'janus', version: '1.0.0' }
    })
  })
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++
      results[current] = await tasks[current]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

export async function probeMcpServers(
  servers: Array<{ name: string; params: Record<string, unknown> }>
): Promise<Map<string, ProbeResult>> {
  // #region agent log
  const probeStartedAt = Date.now()
  const stdioCount = servers.filter((s) => hasStdioTransport(s.params)).length
  agentDebugLog('A', 'mcp-probe.service.ts:probeMcpServers:start', 'MCP probe started', {
    serverCount: servers.length,
    stdioCount,
    maxConcurrent: MAX_CONCURRENT,
    timeoutMs: PROBE_TIMEOUT_MS
  })
  // #endregion

  const results = new Map<string, ProbeResult>()
  const now = Date.now()
  const stale: string[] = []
  for (const [key, entry] of probeCache) {
    if (now - entry.at > PROBE_CACHE_TTL_MS) stale.push(key)
  }
  for (const key of stale) probeCache.delete(key)

  const tasks = servers.map((server) => async () => {
    if (!hasStdioTransport(server.params)) {
      return {
        name: server.name,
        result: {
          status: 'configured' as const,
          tools: [] as McpTool[],
          error: 'Unsupported transport: only stdio MCP servers can be probed'
        }
      }
    }

    const key = paramsKey(server.name, server.params)
    const cached = probeCache.get(key)
    if (cached && now - cached.at <= PROBE_CACHE_TTL_MS) {
      return { name: server.name, result: cached.result }
    }

    // Concurrent scans (StrictMode double-mount, refresh + save racing) share
    // one spawn instead of each opening its own child process.
    let probe = inflight.get(key)
    if (!probe) {
      probe = probeStdioMcp(server.params).then((result) => {
        probeCache.set(key, { at: Date.now(), result })
        inflight.delete(key)
        return result
      })
      inflight.set(key, probe)
    }
    const result = await probe
    return { name: server.name, result }
  })

  const probed = await runWithConcurrency(tasks, MAX_CONCURRENT)
  for (const { name, result } of probed) {
    results.set(name, result)
  }

  // #region agent log
  agentDebugLog('A', 'mcp-probe.service.ts:probeMcpServers:end', 'MCP probe finished', {
    durationMs: Date.now() - probeStartedAt,
    serverCount: servers.length,
    stdioCount
  })
  // #endregion

  return results
}
