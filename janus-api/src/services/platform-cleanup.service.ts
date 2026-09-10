import { existsSync } from 'fs'
import type { PlatformId } from '../shared/types'
import { DEFAULT_PLATFORM_PROJECT_DIRS } from '../shared/types'
import { importedProjectsStore } from './imported-projects-store'
import { fileService } from './file.service'
import { getProjectDotDir } from '../platforms/types'
import { settingsStore } from './settings-store'

export interface PlatformCleanupResult {
  projectsAffected: number
  foldersRemoved: string[]
  errors: string[]
}

function resolveProjectDirName(platformId: PlatformId): string {
  const fromSettings = settingsStore.get().platforms.find((p) => p.id === platformId)
  return fromSettings?.projectDirName?.trim() || DEFAULT_PLATFORM_PROJECT_DIRS[platformId]
}

export class PlatformCleanupService {
  async purgeFromProjects(platformIds: PlatformId[]): Promise<PlatformCleanupResult> {
    const result: PlatformCleanupResult = {
      projectsAffected: 0,
      foldersRemoved: [],
      errors: []
    }

    if (platformIds.length === 0) return result

    const projects = importedProjectsStore
      .get()
      .flatMap((root) => root.projects)

    for (const project of projects) {
      let projectTouched = false

      for (const platformId of platformIds) {
        try {
          const removed = await this.removePlatformFromProject(platformId, project.path)
          if (removed.length > 0) {
            projectTouched = true
            result.foldersRemoved.push(...removed)
          }
        } catch (e) {
          result.errors.push(
            `${project.name} (${platformId}): ${e instanceof Error ? e.message : String(e)}`
          )
        }
      }

      if (projectTouched) {
        result.projectsAffected += 1
      }
    }

    return result
  }

  private async removePlatformFromProject(
    platformId: PlatformId,
    projectPath: string
  ): Promise<string[]> {
    const removed: string[] = []
    const dotDir = getProjectDotDir(projectPath, resolveProjectDirName(platformId))

    if (existsSync(dotDir)) {
      await fileService.removePath(dotDir)
      removed.push(dotDir)
    }

    return removed
  }
}

export const platformCleanupService = new PlatformCleanupService()
