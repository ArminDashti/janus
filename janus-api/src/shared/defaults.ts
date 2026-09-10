import type { AppSettings, PlatformConfig, PlatformId } from './types'
import { DEFAULT_PLATFORM_PROJECT_DIRS, DEFAULT_PLATFORM_ROOTS, PLATFORM_IDS } from './types'
import { expandHome } from './utils'

export function createDefaultSettings(): AppSettings {
  const platforms: PlatformConfig[] = PLATFORM_IDS.map((id) => ({
    id,
    enabled: id === 'cursor',
    rootPath: expandHome(DEFAULT_PLATFORM_ROOTS[id]),
    projectDirName: DEFAULT_PLATFORM_PROJECT_DIRS[id]
  }))

  return {
    window: { maximized: true },
    startup: { runOnLogin: false },
    dataPath: './data',
    platforms,
    projectRoots: [],
    activeApiProvider: 'openRouter',
    openRouter: {
      apiKey: '',
      model: 'openai/gpt-4o-mini'
    },
    cursorApi: {
      apiKey: '',
      model: 'composer-2.5'
    },
    assignments: {
      skills: {},
      rules: {},
      mcps: {},
      hooks: {},
      subAgents: {},
      tools: {}
    },
    mandatoryForAllProjects: {
      skills: {},
      rules: {},
      hooks: {},
      subAgents: {},
      tools: {}
    },
    uiFilters: {}
  }
}

export function getPlatformConfig(
  settings: AppSettings,
  platformId: PlatformId
): PlatformConfig | undefined {
  return settings.platforms.find((p) => p.id === platformId)
}
