import { existsSync } from 'fs'
import { basename, join } from 'path'
import type { PlatformId } from '../shared/types'
import { DEFAULT_PLATFORM_PROJECT_DIRS, PLATFORM_IDS } from '../shared/types'
import { getProjectDotDir } from '../platforms/types'
import { fileService } from './file.service'
import { settingsStore } from './settings-store'

/** ISO-8601 local datetime with numeric offset, e.g. 2026-07-25T11:45:00+03:30 */
function formatLocalIsoWithOffset(date = new Date()): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const offsetHours = pad(Math.floor(abs / 60))
  const offsetMins = pad(abs % 60)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`
}

function resolveProjectDirName(platformId: PlatformId): string {
  const fromSettings = settingsStore.get().platforms.find((p) => p.id === platformId)
  return fromSettings?.projectDirName?.trim() || DEFAULT_PLATFORM_PROJECT_DIRS[platformId]
}

export class ProjectBootstrapService {
  /** Scaffold folders for the given platforms (defaults to all PLATFORM_IDS). */
  async bootstrapProject(
    projectPath: string,
    platformIds: PlatformId[] = PLATFORM_IDS
  ): Promise<void> {
    await this.ensureProjectMetadata(projectPath)
    for (const platformId of platformIds) {
      await this.ensurePlatformFolders(projectPath, platformId)
    }
  }

  async bootstrapProjects(
    projectPaths: string[],
    platformIds?: PlatformId[]
  ): Promise<void> {
    for (const projectPath of projectPaths) {
      await this.bootstrapProject(projectPath, platformIds)
    }
  }

  /** Scaffold folders for every currently enabled platform across all imported projects. */
  async bootstrapEnabledPlatformsForAllProjects(): Promise<void> {
    const settings = settingsStore.get()
    const enabledIds = settings.platforms.filter((p) => p.enabled).map((p) => p.id)
    const projectPaths = settings.projectRoots.flatMap((r) => r.projects.map((p) => p.path))
    await this.bootstrapProjects(projectPaths, enabledIds)
  }

  /** Create `<project>/metadata.json` when missing (import + every startup sync). */
  async ensureProjectMetadata(projectPath: string): Promise<void> {
    const metadataPath = join(projectPath, 'metadata.json')
    if (existsSync(metadataPath)) return

    const payload = {
      name: basename(projectPath),
      version: '1.0.0',
      author: 'Armin Dashti',
      'last-modified': formatLocalIsoWithOffset(),
      licence: 'MIT'
    }
    await fileService.writeText(metadataPath, `${JSON.stringify(payload, null, 2)}\n`)
  }

  async ensurePlatformFolders(projectPath: string, platformId: PlatformId): Promise<void> {
    const dotDir = getProjectDotDir(projectPath, resolveProjectDirName(platformId))
    await fileService.writeText(join(dotDir, 'skills', '.keep'), '')
    await fileService.writeText(join(dotDir, 'rules', '.keep'), '')

    if (platformId === 'cursor') {
      await fileService.writeText(join(dotDir, 'hooks', '.keep'), '')
      await fileService.writeText(join(dotDir, 'agents', '.keep'), '')
      const hooksJson = join(dotDir, 'hooks.json')
      if (!existsSync(hooksJson)) {
        await fileService.writeText(hooksJson, JSON.stringify({ hooks: {} }, null, 2))
      }
    }
  }
}

export const projectBootstrapService = new ProjectBootstrapService()
