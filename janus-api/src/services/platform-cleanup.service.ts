import { existsSync } from 'fs'
import type { PlatformConfig, PlatformId } from '../shared/types'
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

function dirKey(projectDirName: string): string {
  return projectDirName.trim().toLowerCase()
}

function isSafeProjectDirName(projectDirName: string): boolean {
  const trimmed = projectDirName.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..') return false
  return !/[\\/]/.test(trimmed)
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

  /**
   * Settings-toggle cascade: remove the project-level folders of platforms that
   * were just unselected. A folder name still claimed by an enabled platform is
   * left in place so two platforms sharing one dir name can't wipe the other's.
   */
  async purgeUnselectedFromProjects(unselected: PlatformConfig[]): Promise<PlatformCleanupResult> {
    const result: PlatformCleanupResult = {
      projectsAffected: 0,
      foldersRemoved: [],
      errors: []
    }

    const claimed = new Set(
      settingsStore
        .get()
        .platforms.filter((p) => p.enabled)
        .map((p) => dirKey(p.projectDirName))
    )
    const targets = unselected.filter(
      (p) => isSafeProjectDirName(p.projectDirName) && !claimed.has(dirKey(p.projectDirName))
    )
    if (targets.length === 0) return result

    const projects = importedProjectsStore
      .get()
      .flatMap((root) => root.projects)

    for (const project of projects) {
      let projectTouched = false

      for (const config of targets) {
        try {
          const removed = await this.removeProjectDir(config.projectDirName, project.path)
          if (removed.length > 0) {
            projectTouched = true
            result.foldersRemoved.push(...removed)
          }
        } catch (e) {
          result.errors.push(
            `${project.name} (${config.id}): ${e instanceof Error ? e.message : String(e)}`
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
    return this.removeProjectDir(resolveProjectDirName(platformId), projectPath)
  }

  private async removeProjectDir(
    projectDirName: string,
    projectPath: string
  ): Promise<string[]> {
    const removed: string[] = []
    const dotDir = getProjectDotDir(projectPath, projectDirName)

    if (existsSync(dotDir)) {
      await fileService.removePath(dotDir)
      removed.push(dotDir)
    }

    return removed
  }
}

export const platformCleanupService = new PlatformCleanupService()
