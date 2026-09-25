import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { basename, join } from 'path'

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const RUN_VALUE = 'Janus'

function reg(args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('reg.exe', args, { encoding: 'utf-8', windowsHide: true })
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/**
 * Path of the executable the Run entry should launch.
 * Production (SEA): process.execPath is Janus.exe. Dev runs (node/tsx) fall
 * back to the documented local-install location; missing => no autostart.
 */
function resolveLauncher(): string | null {
  if (process.platform !== 'win32') return null

  const override = process.env.JANUS_INSTALL_DIR?.trim()
  if (override) {
    const exe = join(override, 'Janus.exe')
    if (existsSync(exe)) return exe
  }

  if (basename(process.execPath).toLowerCase() === 'janus.exe') {
    return process.execPath
  }

  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (localAppData) {
    const exe = join(localAppData, 'Janus', 'Janus.exe')
    if (existsSync(exe)) return exe
  }
  return null
}

/**
 * `service start` exits once the background server is healthy, but it is a
 * console app — launching it straight from the Run key would flash a terminal
 * at every login. PowerShell's hidden Start-Process keeps the whole launch
 * invisible; the spawned server itself is already created with windowsHide.
 */
function buildRunValue(exe: string): string {
  const quoted = exe.replace(/'/g, "''")
  return (
    'powershell.exe -NoProfile -WindowStyle Hidden -Command "' +
    `Start-Process -WindowStyle Hidden -FilePath '${quoted}' -ArgumentList 'service','start'` +
    '"'
  )
}

function readRunValue(): string | null {
  const r = reg(['query', RUN_KEY, '/v', RUN_VALUE])
  if (r.status !== 0) return null
  const m = /REG_SZ\s+(.+)$/m.exec(r.stdout)
  return m ? m[1].trim() : null
}

/**
 * Apply `startup.runOnLogin`: add/remove the per-user HKCU Run entry so Janus
 * starts at login. No-op off Windows or when no Janus.exe install is found.
 */
export function applyStartupSetting(enabled: boolean): void {
  try {
    if (process.platform !== 'win32') return

    if (!enabled) {
      const r = reg(['delete', RUN_KEY, '/v', RUN_VALUE, '/f'])
      // 1 = value did not exist — already in the desired state.
      if (r.status !== 0 && !/not found/i.test(r.stderr + r.stdout)) {
        console.error('startup: failed to remove Run entry:', r.stderr || r.stdout)
      }
      return
    }

    const exe = resolveLauncher()
    if (!exe) return // dev run with no install — nothing sensible to register

    const value = buildRunValue(exe)
    if (readRunValue() === value) return // already registered — skip the write

    const r = reg(['add', RUN_KEY, '/v', RUN_VALUE, '/t', 'REG_SZ', '/d', value, '/f'])
    if (r.status !== 0) {
      console.error('startup: failed to add Run entry:', r.stderr || r.stdout)
    }
  } catch (err) {
    console.error('startup: applyStartupSetting failed:', err)
  }
}
