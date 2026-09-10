import { join } from 'path'
import type { PlatformAdapter } from './types'
import { createBasePaths, getProjectDotDir } from './types'

function makeAdapter(
  id: PlatformAdapter['id'],
  label: string,
  hooksAndAgents: boolean,
  extraSkillsDir?: string
): PlatformAdapter {
  const supportedResources: PlatformAdapter['supportedResources'] = hooksAndAgents
    ? ['skill', 'rule', 'mcp', 'hook', 'subAgent', 'tool']
    : ['skill', 'rule', 'mcp', 'tool']

  return {
    id,
    label,
    supportedResources,
    getPlatformPaths(rootPath: string) {
      const paths = createBasePaths(rootPath, hooksAndAgents)
      if (extraSkillsDir) {
        paths.skillsDirs.push(join(rootPath, extraSkillsDir))
      }
      return paths
    },
    getProjectPaths(projectPath: string, projectDirName: string) {
      const dotDir = getProjectDotDir(projectPath, projectDirName)
      return createBasePaths(dotDir, hooksAndAgents)
    }
  }
}

export const cursorAdapter = makeAdapter('cursor', 'Cursor', true, 'skills-cursor')
export const antigravityAdapter = makeAdapter('antigravity', 'Antigravity', false)
export const devinAdapter = makeAdapter('devin', 'Devin', false)
export const opencodeAdapter = makeAdapter('opencode', 'OpenCode', false)
export const kiloAdapter = makeAdapter('kilo', 'Kilo', false)

export const allAdapters = [
  antigravityAdapter,
  cursorAdapter,
  devinAdapter,
  kiloAdapter,
  opencodeAdapter
]

export function getAdapter(id: string): PlatformAdapter | undefined {
  return allAdapters.find((a) => a.id === id)
}
