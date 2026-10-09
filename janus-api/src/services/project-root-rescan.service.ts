import { existsSync } from 'fs'
import type { ProjectInfo } from '../shared/types'
import { importedProjectsStore } from './imported-projects-store'
import { projectBootstrapService } from './project-bootstrap.service'
import { scannerService } from './scanner.service'
import { settingsStore } from './settings-store'

/** Strip trailing separators and case-fold for Windows-safe scan-path comparison. */
export function normalizeScanPath(scanPath: string): string {
  return scanPath.replace(/[\\/]+$/, '').toLowerCase()
}

/**
 * A project is any folder containing `.git`. Every stored scan root is
 * re-walked so repositories cloned into a browsed folder after the
 * original import appear without another manual import.
 * Returns the projects that were newly added to the store.
 */
export async function rescanProjectRoots(): Promise<ProjectInfo[]> {
  const roots = importedProjectsStore.get()
  const knownIds = new Set(roots.flatMap((r) => r.projects.map((p) => p.id)))
  const addedByRoot = new Map<string, ProjectInfo[]>()

  for (const root of roots) {
    if (!root.scanPath || !existsSync(root.scanPath)) continue
    const discovered = await scannerService.discoverGitProjects(root.scanPath)
    for (const project of discovered) {
      if (knownIds.has(project.id)) continue
      knownIds.add(project.id)
      const projectWithRoot: ProjectInfo = { ...project, rootId: root.id }
      const bucket = addedByRoot.get(root.id)
      if (bucket) bucket.push(projectWithRoot)
      else addedByRoot.set(root.id, [projectWithRoot])
    }
  }

  if (addedByRoot.size === 0) return []

  importedProjectsStore.update((currentRoots) =>
    currentRoots.map((root) => {
      const added = addedByRoot.get(root.id)
      if (!added || added.length === 0) return root
      return {
        ...root,
        projects: [...root.projects, ...added].sort((a, b) => a.name.localeCompare(b.name))
      }
    })
  )

  const added = [...addedByRoot.values()].flat()
  const enabledIds = settingsStore
    .get()
    .platforms.filter((p) => p.enabled)
    .map((p) => p.id)

  await projectBootstrapService.bootstrapProjects(
    added.map((p) => p.path),
    enabledIds
  )

  return added
}
