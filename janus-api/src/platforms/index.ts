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
    ? ['skill', 'rule', 'mcp', 'hook', 'subAgent']
    : ['skill', 'rule', 'mcp']

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
export const zcodeAdapter = makeAdapter('zcode', 'ZCode', false)
export const hermesAdapter = makeAdapter('hermes', 'Hermes', false)
export const grokAdapter = makeAdapter('grok', 'Grok', false)
export const kiroAdapter = makeAdapter('kiro', 'Kiro', false)

export const allAdapters = [
  antigravityAdapter,
  cursorAdapter,
  devinAdapter,
  grokAdapter,
  hermesAdapter,
  kiloAdapter,
  kiroAdapter,
  opencodeAdapter,
  zcodeAdapter
]

export function getAdapter(id: string): PlatformAdapter | undefined {
  return allAdapters.find((a) => a.id === id)
}
