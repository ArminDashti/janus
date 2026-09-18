import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createDefaultSettings } from '../shared/defaults'
import type { AppSettings } from '../shared/types'
import {
  DEFAULT_PLATFORM_PROJECT_DIRS,
  DEFAULT_PLATFORM_ROOTS,
  PLATFORM_IDS,
  type PlatformId
} from '../shared/types'
import { ruleDisplayName } from '../shared/rule-names'
import { expandHome, isSystemProfilePath } from '../shared/utils'
import { getSettingsPath } from '../app-paths'
import { importedProjectsStore } from './imported-projects-store'

let cached: AppSettings | null = null

function migrateRuleKeys<T>(map: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(map)) {
    const newKey = key.endsWith('.mdc') ? ruleDisplayName(key) : key
    next[newKey] = value
  }
  return next
}

function migrateSettings(settings: AppSettings): AppSettings {
  const defaults = createDefaultSettings()
  const legacy = settings as AppSettings & {
    github?: unknown
    sync?: unknown
    repoBank?: unknown
    resourceCategories?: unknown
    hub?: unknown

  }
  const { github: _g, sync: _s, repoBank: _r, resourceCategories: _c, hub: _h, cursorApi: _ca, ...rest } = legacy
  const merged = { ...defaults, ...rest }

  merged.mandatoryForAllProjects = {
    ...defaults.mandatoryForAllProjects,
    ...settings.mandatoryForAllProjects,
    rules: migrateRuleKeys({
      ...defaults.mandatoryForAllProjects.rules,
      ...(settings.mandatoryForAllProjects?.rules ?? {})
    })
  }

  const knownIds = new Set<string>(PLATFORM_IDS)
  merged.platforms = (settings.platforms ?? defaults.platforms)
    .filter((p) => knownIds.has(p.id))
    .map((p) => {
      const id = p.id as PlatformId
      const trimmed = (p.rootPath ?? '').trim()
      const needsRewrite = !trimmed || isSystemProfilePath(trimmed)
      const rootPath = needsRewrite
        ? expandHome(DEFAULT_PLATFORM_ROOTS[id])
        : trimmed
      const projectDirName =
        typeof p.projectDirName === 'string' && p.projectDirName.trim()
          ? p.projectDirName.trim()
          : DEFAULT_PLATFORM_PROJECT_DIRS[id]
      return {
        id,
        enabled: Boolean(p.enabled),
        rootPath,
        projectDirName
      }
    })

  for (const id of PLATFORM_IDS) {
    if (!merged.platforms.some((p) => p.id === id)) {
      const defaultPlatform = defaults.platforms.find((p) => p.id === id)
      if (defaultPlatform) merged.platforms.push(defaultPlatform)
    }
  }

  merged.uiFilters = {
    ...defaults.uiFilters,
    ...(settings.uiFilters ?? {})
  }

  merged.openRouter = {
    ...defaults.openRouter,
    ...(settings.openRouter ?? {})
  }

  merged.activeApiProvider = 'openRouter'

  return merged
}

function withImportedProjects(settings: AppSettings): AppSettings {
  return {
    ...settings,
    projectRoots: importedProjectsStore.get()
  }
}

function stripPersistedFields(settings: AppSettings): AppSettings {
  const { projectRoots: _roots, ...rest } = settings
  return { ...rest, projectRoots: [] }
}

export class SettingsStore {
  load(): AppSettings {
    if (cached) return withImportedProjects(cached)

    const path = getSettingsPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        const parsed = JSON.parse(raw) as AppSettings
        const loaded = migrateSettings(parsed)

        const legacyRoots = parsed.projectRoots ?? []
        importedProjectsStore.migrateFromSettings(legacyRoots)

        cached = stripPersistedFields(loaded)

        const platformsMigrated = JSON.stringify(parsed.platforms) !== JSON.stringify(cached.platforms)
        if (legacyRoots.length > 0 || platformsMigrated) {
          writeFileSync(getSettingsPath(), `${JSON.stringify(cached, null, 2)}\n`, 'utf-8')
        }

        return withImportedProjects(cached)
      } catch {
        cached = createDefaultSettings()
        return withImportedProjects(cached)
      }
    }

    cached = createDefaultSettings()
    this.persistDisk(cached)
    return withImportedProjects(cached)
  }

  save(settings: AppSettings): void {
    cached = stripPersistedFields(migrateSettings(settings))
    this.persistDisk(cached)
  }

  update(mutator: (settings: AppSettings) => AppSettings): AppSettings {
    const next = mutator(this.get())
    this.save(next)
    return this.get()
  }

  get(): AppSettings {
    return this.load()
  }

  private persistDisk(settings: AppSettings): void {
    writeFileSync(
      getSettingsPath(),
      `${JSON.stringify(stripPersistedFields(settings), null, 2)}\n`,
      'utf-8'
    )
  }
}

export const settingsStore = new SettingsStore()
