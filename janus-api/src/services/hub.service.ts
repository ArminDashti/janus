import { join } from 'path'
import { fileService } from './file.service'
import { repoBankService } from './repo-bank.service'
import { settingsStore } from './settings-store'

export interface HubSource {
  id: string
  label: string
  owner: string
  repo: string
  branch: string
  /** Folder in the repo that holds one sub-folder per skill ('' = repo root). */
  path: string
}

export interface HubSkill {
  /** Skill folder path inside the repo, e.g. `skills/pdf`. */
  path: string
  /** Skill folder name, used as the local skill name. */
  name: string
}

/** Well-known public skill collections on GitHub. */
export const HUB_SOURCES: HubSource[] = [
  {
    id: 'anthropic-skills',
    label: 'Anthropic Skills',
    owner: 'anthropics',
    repo: 'skills',
    branch: 'main',
    path: 'skills'
  },
  {
    id: 'vercel-agent-skills',
    label: 'Vercel Agent Skills',
    owner: 'vercel-labs',
    repo: 'agent-skills',
    branch: 'main',
    path: 'skills'
  },
  {
    id: 'superpowers',
    label: 'Superpowers',
    owner: 'obra',
    repo: 'superpowers',
    branch: 'main',
    path: 'skills'
  }
]

// ponytail: GitHub tree is fetched per call (no cache); unauthenticated limit is 60 req/h.
// Upgrade: cache trees in memory, or set GITHUB_TOKEN for a 5000 req/h limit.
const SKILL_FILE = 'SKILL.md'
const SAFE_SKILL_NAME = /^[A-Za-z0-9._-]+$/

interface TreeEntry {
  path: string
  type: string
}

function findSource(sourceId: string): HubSource {
  const source = HUB_SOURCES.find((s) => s.id === sourceId)
  if (!source) throw new Error(`Unknown hub source: ${sourceId}`)
  return source
}

function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': 'janus-api', Accept: accept }
  const token = process.env.GITHUB_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function fetchTree(source: HubSource): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${source.owner}/${source.repo}/git/trees/${source.branch}?recursive=1`
  const res = await fetch(url, { headers: githubHeaders('application/vnd.github+json') })
  if (!res.ok) throw new Error(`GitHub tree request failed (${res.status}) for ${source.id}`)
  const data = (await res.json()) as { tree: TreeEntry[] }
  return data.tree
}

export async function listHubSkills(sourceId: string): Promise<HubSkill[]> {
  const source = findSource(sourceId)
  const prefix = source.path ? `${source.path}/` : ''
  const skills: HubSkill[] = []
  for (const entry of await fetchTree(source)) {
    if (entry.type !== 'blob' || !entry.path.startsWith(prefix)) continue
    if (!entry.path.endsWith(`/${SKILL_FILE}`)) continue
    const dir = entry.path.slice(0, -`/${SKILL_FILE}`.length)
    const name = dir.slice(prefix.length)
    if (!SAFE_SKILL_NAME.test(name)) continue
    skills.push({ path: dir, name })
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export async function importHubSkill(sourceId: string, skillPath: string): Promise<string> {
  const source = findSource(sourceId)
  const skill = (await listHubSkills(sourceId)).find((s) => s.path === skillPath)
  if (!skill) throw new Error(`Skill not found in hub source: ${skillPath}`)

  const cursor = settingsStore.get().platforms.find((p) => p.enabled && p.id === 'cursor')
  if (!cursor) throw new Error('Cursor platform is not enabled')

  const files = (await fetchTree(source)).filter(
    (e) => e.type === 'blob' && e.path.startsWith(`${skill.path}/`)
  )
  for (const file of files) {
    const rel = file.path.slice(skill.path.length + 1)
    const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch}/${file.path}`
    const res = await fetch(url, { headers: githubHeaders('*/*') })
    if (!res.ok) throw new Error(`Failed to download ${file.path} (${res.status})`)
    // ponytail: text files only (UTF-8); binary assets would be corrupted. Upgrade: write Buffers.
    const content = await res.text()
    // Global Cursor skill (what the Skills page scans) + repo-bank backup.
    await fileService.writeText(join(cursor.rootPath, 'skills', skill.name, rel), content)
    await repoBankService.writeResourceFile('skill', skill.name, rel, content)
  }
  return skill.name
}
