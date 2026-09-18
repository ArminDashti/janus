export type PlatformId =
  | 'cursor'
  | 'antigravity'
  | 'devin'
  | 'opencode'
  | 'kilo'

export type ResourceType =
  | 'skill'
  | 'rule'
  | 'mcp'
  | 'hook'
  | 'subAgent'
  | 'tool'

export interface ResourceSource {
  type: 'platform' | 'project' | 'local'
  id: string
  label: string
}

export interface PlatformConfig {
  id: PlatformId
  enabled: boolean
  /** Global platform root, e.g. C:\\Users\\armin\\.cursor */
  rootPath: string
  /** In-project folder name, e.g. .cursor */
  projectDirName: string
}

export interface ProjectInfo {
  id: string
  name: string
  path: string
  rootId: string
}

export interface ProjectRootConfig {
  id: string
  scanPath: string
  projects: ProjectInfo[]
}

export interface UiFilterState {
  search: string
  selectedProjectId: string
  selectedCategories: string[]
  sortKey: string
  sortDir: 'asc' | 'desc'
}

/** Active provider for API-backed refactor (Settings → API). */
export type ApiProviderId = 'openRouter'

export interface AppSettings {
  window: { maximized: boolean }
  startup: { runOnLogin: boolean }
  dataPath: string
  platforms: PlatformConfig[]
  projectRoots: ProjectRootConfig[]
  /** Which API provider Refactor uses. */
  activeApiProvider: ApiProviderId
  openRouter: {
    apiKey: string
    model: string
  }
  uiFilters: Record<string, Partial<UiFilterState>>
  assignments: {
    skills: Record<string, string[]>
    rules: Record<string, string[]>
    mcps: Record<string, string[]>
    hooks: Record<string, string[]>
    subAgents: Record<string, string[]>
    tools: Record<string, string[]>
  }
  mandatoryForAllProjects: {
    skills: Record<string, boolean>
    rules: Record<string, boolean>
    hooks: Record<string, boolean>
    subAgents: Record<string, boolean>
    tools: Record<string, boolean>
  }
}

export interface SkillResource {
  id: string
  name: string
  rootPath: string
  skillMdPath: string
  /** sha256 hex of SKILL.md contents; same name + different hash = unique skills */
  contentHash: string
  /** Stable identity from frontmatter metadata.uuid */
  uuid: string
  lastUpdatedAt: string | null
  /** False when frontmatter/entry does not match the required metadata structure */
  structureOk: boolean
  structureWarning?: string
  files: string[]
  source: ResourceSource
  enabled: boolean
}

export interface RuleResource {
  id: string
  name: string
  filePath: string
  /** Stable identity from frontmatter metadata.uuid */
  uuid: string
  lastUpdatedAt: string | null
  structureOk: boolean
  structureWarning?: string
  source: ResourceSource
  enabled: boolean
}

export interface McpTool {
  name: string
  description?: string
}

export interface McpResource {
  id: string
  name: string
  owner?: string
  params: Record<string, unknown>
  tools: McpTool[]
  status: 'connected' | 'disconnected' | 'unknown' | 'error' | 'configured'
  platforms: string[]
  configPath: string
}

export interface HookDefinition {
  command?: string
  type?: 'command' | 'prompt'
  matcher?: string
  timeout?: number
  failClosed?: boolean
  loop_limit?: number
  version?: string
  author?: string
  tags?: string[]
  last_updated?: string
  uuid?: string
}

export interface HookResource {
  id: string
  event: string
  name: string
  configPath: string
  definition: HookDefinition
  /** Stable identity from hooks.json entry uuid */
  uuid: string
  lastUpdatedAt: string | null
  structureOk: boolean
  structureWarning?: string
  scriptPath?: string
  scriptFiles: string[]
  source: ResourceSource
  enabled: boolean
}

export interface SubAgentResource {
  id: string
  name: string
  description: string
  filePath: string
  frontmatter: Record<string, unknown>
  /** Stable identity from frontmatter metadata.uuid */
  uuid: string
  lastUpdatedAt: string | null
  structureOk: boolean
  structureWarning?: string
  source: ResourceSource
  enabled: boolean
}

export interface ToolResource {
  id: string
  name: string
  description?: string
  rootPath: string
  entrypoint?: string
  files: string[]
  source: ResourceSource
  enabled: boolean
}

export interface ScanResult {
  skills: SkillResource[]
  rules: RuleResource[]
  mcps: McpResource[]
  hooks: HookResource[]
  subAgents: SubAgentResource[]
  tools: ToolResource[]
}

export interface AssignTarget {
  type: 'platform' | 'project'
  id: string
  label: string
  platformId: PlatformId
}

export interface ProjectMatrixRow {
  projectId: string
  projectName: string
  assigned: boolean
}

export interface ResourceGroupSummary {
  name: string
  /** Stable group identity = metadata UUID */
  groupKey: string
  /** Present for skills; used to disambiguate duplicate folder names in the UI */
  contentHash?: string
  usedProjectCount: number
  totalProjectCount: number
  assignedProjectIds: string[]
  /** True when at least one instance lives in Cursor ~/.cursor (platform source) */
  inGlobal: boolean
  tokenEstimate: number
  lastUpdatedAt: string | null
  mandatory: boolean
  canonicalId: string
  description: string
  event?: string
  /** False when the resource does not follow the required metadata structure */
  structureOk: boolean
  structureWarning?: string
}

export const PLATFORM_IDS: PlatformId[] = [
  'antigravity',
  'cursor',
  'devin',
  'kilo',
  'opencode'
]

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  antigravity: 'Antigravity',
  cursor: 'Cursor',
  devin: 'Devin',
  kilo: 'Kilo',
  opencode: 'OpenCode'
}

export const DEFAULT_PLATFORM_ROOTS: Record<PlatformId, string> = {
  antigravity: '~/.antigravity',
  cursor: '~/.cursor',
  devin: '~/.devin',
  kilo: '~/.config/kilo',
  opencode: '~/.config/opencode'
}

export const DEFAULT_PLATFORM_PROJECT_DIRS: Record<PlatformId, string> = {
  antigravity: '.antigravity',
  cursor: '.cursor',
  devin: '.devin',
  kilo: '.kilo',
  opencode: '.opencode'
}

export const CURSOR_ONLY_RESOURCES: ResourceType[] = ['hook', 'subAgent']

export const PROJECT_ONLY_RESOURCES: ResourceType[] = ['rule']

/** Sentinel target id: create/assign against Cursor ~/.cursor (Global). */
export const GLOBAL_TARGET_KEY = '__global__'

/** Sentinel filter id: show all projects (no project filter). */
export const ALL_PROJECTS_FILTER_KEY = '__all_projects__'
