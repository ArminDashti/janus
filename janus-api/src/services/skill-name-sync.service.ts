import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import type { ScanResult, SkillResource } from '../shared/types'
import { isValidResourceName } from '../shared/resource-names'
import {
  ensureResourceMeta,
  extractResourceMeta,
  metaTimestampToIso,
  parseFrontmatter,
  skillContentHash,
  upsertMarkdownMeta,
  validateSkillStructure
} from '../shared/utils'
import { agentDebugLog } from './debug-log'
import { fileService } from './file.service'
import { withSkillSyncPaused } from './skill-sync.service'
import { withQuietWatch } from './watcher.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface SkillNameSnapshot {
  /** Folder-relative skill name as last seen by the scanner. */
  name: string
  /** SKILL.md frontmatter `name:` as last seen (null when absent). */
  fmName: string | null
}

/** Last-scan state per skill uuid; lets a mismatch decide WHICH side changed. */
let previousByUuid = new Map<string, SkillNameSnapshot>()

type RenameIntent = {
  kind: 'folder-rename' | 'frontmatter-rename'
  from: string
  to: string
}

function folderLeaf(name: string): string {
  const segments = name.replace(/\\/g, '/').split('/').filter(Boolean)
  return segments[segments.length - 1] ?? name
}

function nameWithNewLeaf(name: string, newLeaf: string): string {
  const segments = name.replace(/\\/g, '/').split('/').filter(Boolean)
  if (segments.length === 0) return newLeaf
  segments[segments.length - 1] = newLeaf
  return segments.join('/')
}

function frontmatterNameOf(text: string): string | null {
  const raw = parseFrontmatter(text).frontmatter.name
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed || null
}

/** Set SKILL.md frontmatter `name:`; returns rewritten text when it actually changed. */
async function setSkillFrontmatterName(
  skillMdPath: string,
  newName: string
): Promise<string | null> {
  let content: string
  try {
    content = await fileService.readText(skillMdPath)
  } catch {
    return null
  }
  if (frontmatterNameOf(content) === newName) return null

  const { frontmatter } = parseFrontmatter(content)
  const meta = ensureResourceMeta(extractResourceMeta(frontmatter))
  const next = upsertMarkdownMeta(content, meta, {
    name: newName,
    description: frontmatter.description ?? '',
    'disable-model-invocation': frontmatter['disable-model-invocation'],
    globs: frontmatter.globs,
    alwaysApply: frontmatter.alwaysApply,
    model: frontmatter.model
  })
  await fileService.writeText(skillMdPath, next)
  return next
}

/** Refresh scan-record fields after SKILL.md was rewritten on disk. */
function applyRewrittenText(skill: SkillResource, text: string): void {
  const { frontmatter } = parseFrontmatter(text)
  const meta = extractResourceMeta(frontmatter)
  const structure = validateSkillStructure(frontmatter)
  skill.contentHash = skillContentHash(text)
  skill.lastUpdatedAt = metaTimestampToIso(meta.last_updated)
  skill.structureOk = structure.ok
  skill.structureWarning = structure.ok ? undefined : structure.reason
}

async function moveSkillFolder(skill: SkillResource, newRelativeName: string): Promise<boolean> {
  const newRoot = join(dirname(skill.rootPath), folderLeaf(newRelativeName))
  if (resolve(newRoot) === resolve(skill.rootPath)) return false
  if (existsSync(newRoot)) return false
  try {
    await fileService.renamePath(skill.rootPath, newRoot)
  } catch (err) {
    agentDebugLog('A', 'skill-name-sync.service.ts:moveSkillFolder', 'folder rename failed', {
      from: skill.rootPath,
      to: newRoot,
      error: err instanceof Error ? err.message : String(err)
    })
    return false
  }
  skill.rootPath = newRoot
  skill.skillMdPath = join(newRoot, 'SKILL.md')
  skill.name = newRelativeName
  skill.files = await fileService.listFilesRecursive(newRoot)
  return true
}

/**
 * Reflect skill renames made outside the app:
 * - folder renamed on disk  -> SKILL.md `name:` rewritten (all same-uuid clones follow)
 * - `name:` edited on disk  -> folder renamed (all same-uuid clones follow)
 * - unknown history         -> folder name wins (identity source in Janus)
 */
export async function reconcileSkillNames(result: ScanResult): Promise<void> {
  const skills = result.skills.filter((s) => existsSync(s.skillMdPath))
  const nextSnapshot = new Map<string, SkillNameSnapshot>()
  const intents = new Map<string, RenameIntent>()
  const fmBefore = new Map<SkillResource, string | null>()

  for (const skill of skills) {
    let text = ''
    try {
      text = await fileService.readText(skill.skillMdPath)
    } catch {
      continue
    }
    const fmName = frontmatterNameOf(text)
    fmBefore.set(skill, fmName)
    const leaf = folderLeaf(skill.name)

    if (fmName && fmName !== leaf && skill.uuid && UUID_RE.test(skill.uuid)) {
      const prev = previousByUuid.get(skill.uuid)
      if (prev && prev.name !== skill.name && (fmName === prev.name || fmName === prev.fmName)) {
        // Folder changed externally; frontmatter kept the old name.
        if (!intents.has(skill.uuid)) {
          intents.set(skill.uuid, { kind: 'folder-rename', from: prev.name, to: skill.name })
        }
      } else if (
        prev &&
        prev.name === skill.name &&
        prev.fmName &&
        prev.fmName !== fmName &&
        isValidResourceName(fmName)
      ) {
        // Frontmatter changed externally; folder kept the old name.
        if (!intents.has(skill.uuid)) {
          intents.set(skill.uuid, {
            kind: 'frontmatter-rename',
            from: skill.name,
            to: nameWithNewLeaf(skill.name, fmName)
          })
        }
      }
    }
  }

  await withQuietWatch(async () => {
    await withSkillSyncPaused(async () => {
      for (const skill of skills) {
        try {
          const intent = skill.uuid ? intents.get(skill.uuid) : undefined
          if (intent && skill.name === intent.from) {
            const moved = await moveSkillFolder(skill, intent.to)
            const leaf = folderLeaf(skill.name)
            if (moved) {
              const rewritten = await setSkillFrontmatterName(skill.skillMdPath, leaf)
              if (rewritten) applyRewrittenText(skill, rewritten)
            } else {
              // Destination taken: keep this instance on its folder name.
              const rewritten = await setSkillFrontmatterName(skill.skillMdPath, leaf)
              if (rewritten) applyRewrittenText(skill, rewritten)
              if (intent.kind === 'frontmatter-rename') intents.delete(skill.uuid)
            }
          } else if (intent && intent.kind === 'folder-rename' && skill.name === intent.to) {
            // The externally renamed instance itself: converge frontmatter to folder.
            const rewritten = await setSkillFrontmatterName(skill.skillMdPath, folderLeaf(skill.name))
            if (rewritten) applyRewrittenText(skill, rewritten)
          } else {
            // No rename intent for this instance: folder name is authoritative.
            const fmName = fmBefore.get(skill) ?? null
            const leaf = folderLeaf(skill.name)
            if (fmName && fmName !== leaf) {
              const rewritten = await setSkillFrontmatterName(skill.skillMdPath, leaf)
              if (rewritten) applyRewrittenText(skill, rewritten)
            }
          }

          // After reconcile the frontmatter either matches the folder or is absent;
          // record that converged state as history for the next scan.
          if (skill.uuid && UUID_RE.test(skill.uuid)) {
            nextSnapshot.set(skill.uuid, {
              name: skill.name,
              fmName: fmBefore.get(skill) === null ? null : folderLeaf(skill.name)
            })
          }
        } catch (err) {
          agentDebugLog('A', 'skill-name-sync.service.ts:reconcile', 'skill reconcile failed', {
            skill: skill.name,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }
    })
  })

  previousByUuid = nextSnapshot
}
