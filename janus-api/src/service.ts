import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export const SERVICE_NAME = 'janus'
export const SERVICE_DISPLAY = 'Janus'
export const DEFAULT_URL = 'http://127.0.0.1:8005'

function sc(...args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('sc.exe', args, { encoding: 'utf-8', windowsHide: true })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  }
}

function resolvePackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  if (existsSync(join(here, 'package.json'))) {
    return here
  }
  const parent = join(here, '..')
  if (existsSync(join(parent, 'package.json'))) {
    return parent
  }
  return process.cwd()
}

function resolveServiceBinary(): string {
  const packageRoot = resolvePackageRoot()
  const node = process.execPath
  const tsxCli = join(packageRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const cliTs = join(packageRoot, 'src', 'cli.ts')
  return `"${node}" "${tsxCli}" "${cliTs}" run`
}

export function install(): void {
  const binPath = resolveServiceBinary()
  const create = sc(
    'create',
    SERVICE_NAME,
    `binPath= ${binPath}`,
    'start= auto',
    `DisplayName= ${SERVICE_DISPLAY}`
  )
  if (create.status !== 0) {
    throw new Error(`sc create failed (may need elevation):\n${create.stderr || create.stdout}`)
  }
  sc('description', SERVICE_NAME, 'Local Janus HTTP API for janus-webui (skills, rules, hooks, …)')
  sc('failure', SERVICE_NAME, 'reset= 86400', 'actions= restart/5000/restart/5000/restart/5000')
  console.log(`Installed Windows service '${SERVICE_NAME}' (${SERVICE_DISPLAY})`)
  console.log(`Listening URL when running: ${DEFAULT_URL}`)
}

export function uninstall(): void {
  stop()
  const result = sc('delete', SERVICE_NAME)
  if (result.status !== 0) {
    throw new Error(`sc delete failed (may need elevation):\n${result.stderr || result.stdout}`)
  }
  console.log(`Uninstalled Windows service '${SERVICE_NAME}'`)
}

export function start(): void {
  const result = sc('start', SERVICE_NAME)
  if (result.status !== 0) {
    throw new Error(`sc start failed (may need elevation):\n${result.stderr || result.stdout}`)
  }
  console.log(`Started '${SERVICE_NAME}' → ${DEFAULT_URL}`)
}

export function stop(): void {
  sc('stop', SERVICE_NAME)
  console.log(`Stopped '${SERVICE_NAME}'`)
}

export function restart(): void {
  stop()
  start()
}

export function status(): void {
  const output = sc('query', SERVICE_NAME)
  if (output.status !== 0) {
    console.log(`Service: ${SERVICE_NAME}`)
    console.log('Installed: no')
    console.log('State: not installed')
    console.log(`URL: ${DEFAULT_URL} (when running)`)
    if (output.stderr.trim()) console.log(`Detail: ${output.stderr.trim()}`)
    return
  }

  const text = output.stdout
  const state =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith('STATE'))
      ?.split(':')[1]
      ?.trim()
      .split(/\s+/)
      .pop() ?? 'unknown'

  console.log(`Service: ${SERVICE_NAME}`)
  console.log(`Display: ${SERVICE_DISPLAY}`)
  console.log('Installed: yes')
  console.log(`State: ${state}`)
  console.log(`URL: ${DEFAULT_URL}`)
}
