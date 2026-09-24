import type {
  AppSettings,
  AssignTarget,
  HookResource,
  McpProbeResult,
  PlatformId,
  ProjectMatrixRow,
  ResourceGroupSummary,
  ResourceType,
  RuleResource,
  ScanResult,
  SkillResource,
  SubAgentResource,
  ToolResource
} from '@shared/types'

export interface AgentManagerApi {
  getAppRoot: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  scanAll: (options?: { probeMcps?: boolean }) => Promise<ScanResult>
  discoverProjects: (scanPath: string) => Promise<ScanResult['skills']>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  listDir: (path: string) => Promise<string[]>
  listEntries: (path: string) => Promise<{ path: string; name: string; isDirectory: boolean }[]>
  openDirectory: () => Promise<string | null>
  openDirectories: () => Promise<string[]>
  getAssignTargets: (resourceType: ResourceType) => Promise<AssignTarget[]>
  getResourceStats: (resourceType: Exclude<ResourceType, 'mcp'>) => Promise<ResourceGroupSummary[]>
  getProjectMatrix: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ) => Promise<ProjectMatrixRow[]>
  applyProjectAssignment: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string,
    assignedProjectIds: string[]
  ) => Promise<boolean>
  applyAllToAllProjects: (resourceType: Exclude<ResourceType, 'mcp'>) => Promise<number>
  setMandatory: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string,
    mandatory: boolean
  ) => Promise<boolean>
  renameResource: (
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    oldName: string,
    newName: string
  ) => Promise<boolean>
  deleteResource: (resourceType: Exclude<ResourceType, 'mcp'>, resourceName: string) => Promise<boolean>
  createResource: (
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string,
    projectIds: string[]
  ) => Promise<boolean>
  getCanonicalResource: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ) => Promise<SkillResource | RuleResource | HookResource | SubAgentResource | ToolResource | null>
  deleteMcp: (name: string, configPath: string) => Promise<boolean>
  addMcp: (name: string, params: Record<string, unknown>) => Promise<string>
  testMcp: (name: string, params: Record<string, unknown>) => Promise<McpProbeResult>
  addPlatform: (id: PlatformId, rootPath: string, projectDirName?: string) => Promise<AppSettings>
  addProjectRoot: (scanPath: string) => Promise<{ id: string; projects: unknown[] }>
  importProjects: (paths: string[]) => Promise<{ imported: number; projects: unknown[] }>
  removeProject: (projectId: string) => Promise<boolean>
  getLogoPath: (platformId: string) => Promise<string | null>
  getBrandingPath: (name: 'janus-icon' | 'janus-logo') => Promise<string | null>
  purgePlatformsFromProjects: (platformIds: PlatformId[]) => Promise<{
    projectsAffected: number
    foldersRemoved: string[]
    errors: string[]
  }>
  minimizeWindow: () => Promise<boolean>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>
  isWindowMaximized: () => Promise<boolean>
  debugLog: (
    hypothesisId: string,
    location: string,
    message: string,
    data?: Record<string, unknown>
  ) => Promise<boolean>
  writeSkillMd: (filePath: string, content: string, currentResourceName: string) => Promise<boolean>
  listInstructions: () => Promise<string[]>
  readInstruction: (name: string) => Promise<string>
  saveInstruction: (name: string, content: string) => Promise<boolean>
  createInstruction: (name: string) => Promise<string>
  apiRefactor: (params: {
    resourceType: string
    content: string
    userPrompt: string
  }) => Promise<{ content: string }>
}

declare global {
  interface Window {
    agentManager: AgentManagerApi
  }
}

export {}
