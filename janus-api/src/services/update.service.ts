import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { getAppRoot } from '../app-paths'
import type {
  UpdateApplyResult,
  UpdateCheckResult,
  UpdateCommitInfo
} from '../shared/types'

const execFileAsync = promisify(execFile)

async function git(args: string[], timeoutMs = 20_000): Promise<string> {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', getAppRoot(), ...args],
    { encoding: 'utf-8', timeout: timeoutMs, windowsHide: true }
  )
  return stdout.trim()
}

function appVersion(): string {
  try {
    const raw = readFileSync(join(getAppRoot(), 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function emptyResult(): UpdateCheckResult {
  return {
    currentVersion: appVersion(),
    branch: '',
    remoteUrl: null,
    currentSha: '',
    remoteSha: null,
    behind: 0,
    ahead: 0,
    dirty: false,
    hasUpdate: false,
    incoming: [],
    checkedAt: new Date().toISOString()
  }
}

function parseIncomingLog(raw: string): UpdateCommitInfo[] {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha = '', author = '', date = '', subject = ''] = line.split('\u0009')
      return { sha, author, date, subject }
    })
}

/** Fetch origin and compare the running install checkout against its upstream branch. */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const result = emptyResult()
  try {
    await git(['rev-parse', '--is-inside-work-tree'])
    result.branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
    try {
      result.remoteUrl = await git(['remote', 'get-url', 'origin'])
    } catch {
      result.error = 'This Janus install has no git remote "origin" to update from.'
      return result
    }

    await git(['fetch', '--quiet', 'origin', result.branch], 60_000)

    result.currentSha = await git(['rev-parse', 'HEAD'])
    try {
      result.remoteSha = await git(['rev-parse', `refs/remotes/origin/${result.branch}`])
    } catch {
      result.error = `Origin has no "${result.branch}" branch to compare against.`
      return result
    }

    const counts = await git([
      'rev-list',
      '--left-right',
      '--count',
      `HEAD...refs/remotes/origin/${result.branch}`
    ])
    const [ahead = 0, behind = 0] = counts.split(/\s+/).map((n) => parseInt(n, 10) || 0)
    result.ahead = ahead
    result.behind = behind

    const status = await git(['status', '--porcelain'])
    result.dirty = status.length > 0

    result.hasUpdate = behind > 0
    if (result.hasUpdate) {
      const log = await git([
        'log',
        '--format=%H\u0009%an\u0009%ad\u0009%s',
        `HEAD..refs/remotes/origin/${result.branch}`
      ])
      result.incoming = parseIncomingLog(log)
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.error = /not a git repository/i.test(message)
      ? 'This Janus install is not a git checkout, so it cannot update itself.'
      : message
    return result
  }
}

/** Fast-forward the install checkout to origin; refuses dirty or diverged trees. */
export async function applyUpdate(): Promise<UpdateApplyResult> {
  const check = await checkForUpdates()
  const base: UpdateApplyResult = {
    updated: false,
    fromSha: check.currentSha,
    toSha: check.currentSha,
    message: '',
    restartRequired: false
  }

  if (check.error) return { ...base, message: check.error }
  if (check.dirty) {
    return { ...base, message: 'Uncommitted changes in the Janus folder block the update. Commit or revert them first.' }
  }
  if (check.ahead > 0 && check.behind > 0) {
    return { ...base, message: 'Local commits have diverged from origin. Update manually with git pull.' }
  }
  if (!check.hasUpdate) {
    return { ...base, message: 'Janus is already up to date.' }
  }

  await git(['pull', '--ff-only', 'origin', check.branch], 120_000)
  const toSha = await git(['rev-parse', 'HEAD'])
  return {
    updated: toSha !== check.currentSha,
    fromSha: check.currentSha,
    toSha,
    message:
      toSha !== check.currentSha
        ? `Updated ${check.currentSha.slice(0, 7)} → ${toSha.slice(0, 7)}. Restart Janus to load the new version.`
        : 'Janus is already up to date.',
    restartRequired: toSha !== check.currentSha
  }
}
