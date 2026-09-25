import { watch } from 'chokidar'
import { join } from 'path'
import { existsSync } from 'fs'
import { settingsStore } from './settings-store'
import { getAdapter } from '../platforms'
import { scheduleSkillSyncFromPath } from './skill-sync.service'
import { notifyScanChanged } from '../events'

let watcher: ReturnType<typeof watch> | null = null
let changeNotifyTimer: ReturnType<typeof setTimeout> | null = null
let unlinkNotifyTimer: ReturnType<typeof setTimeout> | null = null
let quietDepth = 0

const CHANGE_DEBOUNCE_MS = 400
const UNLINK_DEBOUNCE_MS = 75

function collectWatchPaths(): string[] {
  const settings = settingsStore.get()
  const paths = new Set<string>()

  for (const platform of settings.platforms) {
    if (!platform.enabled) continue
    const adapter = getAdapter(platform.id)
    if (!adapter) continue

    const platformPaths = adapter.getPlatformPaths(platform.rootPath)
    const candidates = [join(platform.rootPath, 'mcp.json')]

    for (const p of candidates) {
      if (p && existsSync(p)) paths.add(p)
    }
  }

  for (const root of settings.projectRoots) {
    for (const project of root.projects) {
      for (const platform of settings.platforms) {
        if (!platform.enabled) continue
        const adapter = getAdapter(platform.id)
        if (!adapter) continue
        const projectPaths = adapter.getProjectPaths(project.path, platform.projectDirName)

        if (platform.id === 'cursor') {
          const candidates = [
            ...projectPaths.skillsDirs,
            projectPaths.rulesDir,
            projectPaths.hooksScriptsDir,
            projectPaths.agentsDir,
            projectPaths.hooksConfigPath
          ]
          for (const p of candidates) {
            if (p && existsSync(p)) paths.add(p)
          }
        } else {
          for (const skillsDir of projectPaths.skillsDirs) {
            if (existsSync(skillsDir)) paths.add(skillsDir)
          }
          if (existsSync(projectPaths.mcpConfigPath)) paths.add(projectPaths.mcpConfigPath)
        }
      }
    }
  }

  return [...paths]
}

function emitScanChanged(): void {
  notifyScanChanged()
}

function notifyChange(): void {
  if (quietDepth > 0) return
  if (changeNotifyTimer) clearTimeout(changeNotifyTimer)
  changeNotifyTimer = setTimeout(() => {
    changeNotifyTimer = null
    if (quietDepth > 0) return
    emitScanChanged()
  }, CHANGE_DEBOUNCE_MS)
}

function notifyUnlink(): void {
  if (quietDepth > 0) return
  if (unlinkNotifyTimer) clearTimeout(unlinkNotifyTimer)
  unlinkNotifyTimer = setTimeout(() => {
    unlinkNotifyTimer = null
    if (quietDepth > 0) return
    emitScanChanged()
  }, UNLINK_DEBOUNCE_MS)
}

export function beginQuietWatch(): void {
  quietDepth++
}

export function endQuietWatch(): void {
  quietDepth = Math.max(0, quietDepth - 1)
}

export async function withQuietWatch<T>(fn: () => Promise<T>): Promise<T> {
  beginQuietWatch()
  try {
    return await fn()
  } finally {
    endQuietWatch()
  }
}

export function startFileWatcher(): void {
  if (watcher) return

  const paths = collectWatchPaths()
  if (paths.length === 0) return

  watcher = watch(paths, {
    ignoreInitial: true,
    depth: 12,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  })

  const onAddOrChange = (changedPath: string): void => {
    scheduleSkillSyncFromPath(changedPath)
    notifyChange()
  }

  const onUnlink = (): void => {
    notifyUnlink()
  }

  watcher
    .on('add', onAddOrChange)
    .on('change', onAddOrChange)
    .on('unlink', onUnlink)
    .on('unlinkDir', onUnlink)
}

export function stopFileWatcher(): void {
  if (changeNotifyTimer) {
    clearTimeout(changeNotifyTimer)
    changeNotifyTimer = null
  }
  if (unlinkNotifyTimer) {
    clearTimeout(unlinkNotifyTimer)
    unlinkNotifyTimer = null
  }
  void watcher?.close()
  watcher = null
}
