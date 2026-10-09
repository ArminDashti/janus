import { join } from 'path'
import type { PlatformId, ResourceType } from '../shared/types'
import { CURSOR_ONLY_RESOURCES } from '../shared/types'

export interface PlatformPaths {
  skillsDirs: string[]
  mcpConfigPath: string
  agentsDir: string
}

export interface PlatformAdapter {
  id: PlatformId
  label: string
  supportedResources: ResourceType[]
  getPlatformPaths(rootPath: string): PlatformPaths
  getProjectPaths(projectPath: string, projectDirName: string): PlatformPaths
}

export function getProjectDotDir(projectPath: string, projectDirName: string): string {
  const name = projectDirName.trim() || '.'
  return joinPath(projectPath, name)
}

function joinPath(...parts: string[]): string {
  return join(...parts)
}

export function createBasePaths(root: string, hooksAndAgents: boolean): PlatformPaths {
  const paths: PlatformPaths = {
    skillsDirs: [joinPath(root, 'skills')],
    mcpConfigPath: joinPath(root, 'mcp.json'),
    agentsDir: joinPath(root, 'agents')
  }

  if (!hooksAndAgents) {
    paths.agentsDir = ''
  }

  return paths
}

export function supportsResource(adapter: PlatformAdapter, type: ResourceType): boolean {
  if (CURSOR_ONLY_RESOURCES.includes(type)) {
    return adapter.id === 'cursor'
  }
  return adapter.supportedResources.includes(type)
}
