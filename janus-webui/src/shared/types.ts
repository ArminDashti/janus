export type PlatformId =
  | 'cursor'
  | 'antigravity'
  | 'devin'
  | 'opencode'
  | 'kilo'
  | 'zcode'
  | 'hermes'
  | 'grok'
  | 'kiro'

export type ResourceType =
  | 'skill'
  | 'rule'
  | 'mcp'
  | 'hook'
  | 'subAgent'

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

/** Which field the list search box matches against (item 14). */
export type UiSearchField = 'name' | 'tags' | 'category'

export interface UiFilterState {
  search: string
  /** Field the search box matches; defaults to 'name'. */
  searchField: UiSearchField
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
  /** UI theme id, e.g. vscode-dark, github-dark, dracula. */
  theme: string
  /** UI font family name, e.g. 'Segoe UI', 'Inter'. */
  font: string
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
  /** Per-MCP enabled state keyed by MCP name (absent ⇒ enabled). */
  mcpEnabled?: Record<string, boolean>
  assignments: {
    skills: Record<string, string[]>
    rules: Record<string, string[]>
    mcps: Record<string, string[]>
    hooks: Record<string, string[]>
    subAgents: Record<string, string[]>
  }
  mandatoryForAllProjects: {
    skills: Record<string, boolean>
    rules: Record<string, boolean>
    hooks: Record<string, boolean>
    subAgents: Record<string, boolean>
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
  /** Last probe failure detail; present when status is error/disconnected or transport is untestable. */
  error?: string
  platforms: string[]
  configPath: string
  /** False when disabled via the MCPs page (settings.mcpEnabled). */
  enabled: boolean
}

/** Result of probing a single MCP server (scan-time or on-demand test). */
export interface McpProbeResult {
  status: McpResource['status']
  tools: McpTool[]
  error?: string
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

export interface ScanResult {
  skills: SkillResource[]
  rules: RuleResource[]
  mcps: McpResource[]
  hooks: HookResource[]
  subAgents: SubAgentResource[]
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
  /** Present on IDE/CLI global rows (`projectId = platform:<id>`); absent on project rows. */
  platformId?: PlatformId
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
  /** Frontmatter tags (only present when the file declares them). */
  tags?: string[]
  /** Frontmatter category — only when the file declares one; never invented. */
  category?: string
  event?: string
  /** False when the resource does not follow the required metadata structure */
  structureOk: boolean
  structureWarning?: string
}

export const PLATFORM_IDS: PlatformId[] = [
  'antigravity',
  'cursor',
  'devin',
  'grok',
  'hermes',
  'kilo',
  'kiro',
  'opencode',
  'zcode'
]

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  antigravity: 'Antigravity',
  cursor: 'Cursor',
  devin: 'Devin',
  grok: 'Grok',
  hermes: 'Hermes',
  kilo: 'Kilo',
  kiro: 'Kiro',
  opencode: 'OpenCode',
  zcode: 'ZCode'
}

export const DEFAULT_PLATFORM_ROOTS: Record<PlatformId, string> = {
  antigravity: '~/.antigravity',
  cursor: '~/.cursor',
  devin: '~/.devin',
  grok: '~/.grok',
  hermes: '~/.hermes',
  kilo: '~/.config/kilo',
  kiro: '~/.kiro',
  opencode: '~/.config/opencode',
  zcode: '~/.zcode'
}

export const DEFAULT_PLATFORM_PROJECT_DIRS: Record<PlatformId, string> = {
  antigravity: '.antigravity',
  cursor: '.cursor',
  devin: '.devin',
  grok: '.grok',
  hermes: '.hermes',
  kilo: '.kilo',
  kiro: '.kiro',
  opencode: '.opencode',
  zcode: '.zcode'
}

export const CURSOR_ONLY_RESOURCES: ResourceType[] = ['hook', 'subAgent']

export const PROJECT_ONLY_RESOURCES: ResourceType[] = ['rule']

/** Sentinel target id: create/assign against Cursor ~/.cursor (Global). */
export const GLOBAL_TARGET_KEY = '__global__'

/** Sentinel filter id: show all projects (no project filter). */
export const ALL_PROJECTS_FILTER_KEY = '__all_projects__'
