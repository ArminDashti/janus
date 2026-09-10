import { createHash } from 'crypto'
import { basename } from 'path'
import { existsSync } from 'fs'
import type {
  HookResource,
  RuleResource,
  ScanResult,
  SkillResource,
  SubAgentResource
} from '../shared/types'
import { ruleDisplayName } from '../shared/rule-names'
import {
  extractResourceMeta,
  ensureResourceMeta,
  formatMetaTimestamp,
  metaTimestampToIso,
  newResourceUuid,
  parseFrontmatter,
  skillContentHash,
  upsertMarkdownMeta,
  validateHookStructure,
  validateRuleStructure,
  validateSkillStructure,
  validateSubAgentStructure
} from '../shared/utils'
import { fileService } from './file.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Identity ignores uuid + last_updated so diverged copies still match. */
export function markdownIdentityDigest(content: string): string {
  const { frontmatter, body } = parseFrontmatter(content)
  const meta = extractResourceMeta(frontmatter)
  const nested =
    frontmatter.metadata && typeof frontmatter.metadata === 'object'
      ? (frontmatter.metadata as Record<string, unknown>)
      : {}
  const tags = Array.isArray(nested.tags)
    ? (nested.tags as unknown[]).map(String).join(',')
    : Array.isArray(meta.tags)
      ? meta.tags.join(',')
      : ''

  return sha256(
    [
      String(frontmatter.name ?? ''),
      String(frontmatter.description ?? ''),
      String(frontmatter['disable-model-invocation'] ?? ''),
      String(frontmatter.globs ?? ''),
      String(frontmatter.alwaysApply ?? ''),
      String(frontmatter.model ?? ''),
      String(meta.version ?? nested.version ?? ''),
      String(meta.author ?? nested.author ?? ''),
      tags,
      body.trim()
    ].join('\n')
  )
}

export function hookIdentityDigest(event: string, entry: Record<string, unknown>): string {
  return sha256(
    [
      event,
      String(entry.command ?? ''),
      String(entry.type ?? ''),
      String(entry.matcher ?? ''),
      String(entry.timeout ?? ''),
      String(entry.loop_limit ?? '')
    ].join('|')
  )
}

function pickSharedUuid(candidates: Array<string | undefined>): string {
  const counts = new Map<string, number>()
  for (const raw of candidates) {
    const u = raw?.trim()
    if (!u || !UUID_RE.test(u)) continue
    counts.set(u, (counts.get(u) ?? 0) + 1)
  }
  if (counts.size === 0) return newResourceUuid()

  let best = ''
  let bestCount = -1
  for (const [uuid, count] of counts) {
    if (count > bestCount || (count === bestCount && uuid < best)) {
      best = uuid
      bestCount = count
    }
  }
  return best
}

async function rewriteMarkdownUuid(
  filePath: string,
  sharedUuid: string,
  topLevelExtras?: Record<string, unknown>
): Promise<{ content: string; frontmatter: Record<string, unknown> }> {
  const content = await fileService.readText(filePath)
  const { frontmatter } = parseFrontmatter(content)
  const existing = extractResourceMeta(frontmatter)
  if (existing.uuid === sharedUuid) {
    return { content, frontmatter }
  }
  const meta = ensureResourceMeta({
    ...existing,
    uuid: sharedUuid,
    // Keep existing last_updated when present; only stamp if missing
    last_updated: existing.last_updated || formatMetaTimestamp()
  })
  const next = upsertMarkdownMeta(content, meta, {
    name: frontmatter.name,
    description: frontmatter.description ?? '',
    'disable-model-invocation': frontmatter['disable-model-invocation'],
    globs: frontmatter.globs,
    alwaysApply: frontmatter.alwaysApply,
    model: frontmatter.model,
    ...topLevelExtras
  })
  await fileService.writeText(filePath, next)
  return { content: next, frontmatter: parseFrontmatter(next).frontmatter }
}

/**
 * Ensure identical Skills / Rules / Hooks / Sub-agents across projects share one UUID.
 * Mutates `result` in place and rewrites on-disk metadata when needed.
 */
export async function reconcileSharedUuids(result: ScanResult): Promise<void> {
  await reconcileSkills(result.skills)
  await reconcileRules(result.rules)
  await reconcileSubAgents(result.subAgents)
  await reconcileHooks(result.hooks)
}

async function reconcileSkills(skills: SkillResource[]): Promise<void> {
  const groups = new Map<string, SkillResource[]>()
  const digests = new Map<SkillResource, string>()

  for (const skill of skills) {
    if (!existsSync(skill.skillMdPath)) continue
    const text = await fileService.readText(skill.skillMdPath)
    const digest = markdownIdentityDigest(text)
    digests.set(skill, digest)
    const key = `skill|${skill.name}|${digest}`
    const list = groups.get(key) ?? []
    list.push(skill)
    groups.set(key, list)
  }

  for (const group of groups.values()) {
    const sharedUuid = pickSharedUuid(group.map((s) => s.uuid))
    for (const skill of group) {
      if (skill.uuid === sharedUuid && UUID_RE.test(skill.uuid)) {
        skill.id = sharedUuid
        continue
      }
      const { content, frontmatter } = await rewriteMarkdownUuid(skill.skillMdPath, sharedUuid)
      const structure = validateSkillStructure(frontmatter)
      const meta = extractResourceMeta(frontmatter)
      skill.uuid = sharedUuid
      skill.id = sharedUuid
      skill.contentHash = skillContentHash(content)
      skill.lastUpdatedAt = metaTimestampToIso(meta.last_updated)
      skill.structureOk = structure.ok
      skill.structureWarning = structure.ok ? undefined : structure.reason
    }
  }
}

async function reconcileRules(rules: RuleResource[]): Promise<void> {
  const groups = new Map<string, RuleResource[]>()

  for (const rule of rules) {
    if (!existsSync(rule.filePath)) continue
    const text = await fileService.readText(rule.filePath)
    const digest = markdownIdentityDigest(text)
    const key = `rule|${ruleDisplayName(rule.name)}|${digest}`
    const list = groups.get(key) ?? []
    list.push(rule)
    groups.set(key, list)
  }

  for (const group of groups.values()) {
    const sharedUuid = pickSharedUuid(group.map((r) => r.uuid))
    for (const rule of group) {
      if (rule.uuid === sharedUuid && UUID_RE.test(rule.uuid)) {
        rule.id = sharedUuid
        continue
      }
      const { frontmatter } = await rewriteMarkdownUuid(rule.filePath, sharedUuid)
      const structure = validateRuleStructure(frontmatter)
      const meta = extractResourceMeta(frontmatter)
      rule.uuid = sharedUuid
      rule.id = sharedUuid
      rule.lastUpdatedAt = metaTimestampToIso(meta.last_updated)
      rule.structureOk = structure.ok
      rule.structureWarning = structure.ok ? undefined : structure.reason
    }
  }
}

async function reconcileSubAgents(agents: SubAgentResource[]): Promise<void> {
  const groups = new Map<string, SubAgentResource[]>()

  for (const agent of agents) {
    if (!existsSync(agent.filePath)) continue
    const text = await fileService.readText(agent.filePath)
    const digest = markdownIdentityDigest(text)
    const key = `subAgent|${agent.name}|${digest}`
    const list = groups.get(key) ?? []
    list.push(agent)
    groups.set(key, list)
  }

  for (const group of groups.values()) {
    const sharedUuid = pickSharedUuid(group.map((a) => a.uuid))
    for (const agent of group) {
      if (agent.uuid === sharedUuid && UUID_RE.test(agent.uuid)) {
        agent.id = sharedUuid
        continue
      }
      const { content, frontmatter } = await rewriteMarkdownUuid(agent.filePath, sharedUuid)
      const structure = validateSubAgentStructure(frontmatter)
      const meta = extractResourceMeta(frontmatter)
      agent.uuid = sharedUuid
      agent.id = sharedUuid
      agent.frontmatter = frontmatter
      agent.description = String(frontmatter.description ?? agent.description)
      agent.lastUpdatedAt = metaTimestampToIso(meta.last_updated)
      agent.structureOk = structure.ok
      agent.structureWarning = structure.ok ? undefined : structure.reason
      void content
    }
  }
}

async function reconcileHooks(hooks: HookResource[]): Promise<void> {
  const groups = new Map<string, HookResource[]>()

  for (const hook of hooks) {
    const entry = hook.definition as unknown as Record<string, unknown>
    const digest = hookIdentityDigest(hook.event, entry)
    const commandBase = basename(String(entry.command ?? '')) || 'hook'
    const key = `hook|${hook.event}|${commandBase}|${digest}`
    const list = groups.get(key) ?? []
    list.push(hook)
    groups.set(key, list)
  }

  // Group rewrites by config path so we only write each hooks.json once
  const dirtyConfigs = new Map<string, { parsed: { hooks?: Record<string, Array<Record<string, unknown>>> }; touched: boolean }>()

  for (const group of groups.values()) {
    const sharedUuid = pickSharedUuid(
      group.map((h) => h.uuid || (h.definition as { uuid?: string }).uuid)
    )

    for (const hook of group) {
      if (hook.uuid === sharedUuid && UUID_RE.test(hook.uuid)) {
        hook.id = sharedUuid
        continue
      }

      if (!existsSync(hook.configPath)) continue

      let cache = dirtyConfigs.get(hook.configPath)
      if (!cache) {
        const raw = await fileService.readText(hook.configPath)
        cache = {
          parsed: JSON.parse(raw) as {
            hooks?: Record<string, Array<Record<string, unknown>>>
          },
          touched: false
        }
        dirtyConfigs.set(hook.configPath, cache)
      }

      const entries = cache.parsed.hooks?.[hook.event] ?? []
      const command = hook.definition.command ?? ''
      for (const entry of entries) {
        if (String(entry.command ?? '') !== command) continue
        // Match this hook instance (by old uuid if present)
        if (entry.uuid && hook.uuid && entry.uuid !== hook.uuid) continue

        const existing = {
          version: String(entry.version ?? ''),
          author: String(entry.author ?? ''),
          tags: Array.isArray(entry.tags) ? (entry.tags as string[]) : [],
          last_updated: String(entry.last_updated ?? ''),
          uuid: sharedUuid
        }
        const meta = ensureResourceMeta(existing)
        entry.uuid = meta.uuid
        entry.version = meta.version
        entry.author = meta.author
        delete entry.category
        entry.tags = meta.tags
        entry.last_updated = meta.last_updated || formatMetaTimestamp()
        cache.touched = true

        const structure = validateHookStructure(entry)
        hook.uuid = sharedUuid
        hook.id = sharedUuid
        hook.definition = entry as HookResource['definition']
        hook.lastUpdatedAt = metaTimestampToIso(meta.last_updated)
        hook.structureOk = structure.ok
        hook.structureWarning = structure.ok ? undefined : structure.reason
        break
      }
    }
  }

  for (const [configPath, cache] of dirtyConfigs) {
    if (!cache.touched) continue
    await fileService.writeText(configPath, JSON.stringify(cache.parsed, null, 2))
  }
}
