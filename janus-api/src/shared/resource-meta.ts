export interface ResourceMeta {
  version: string
  author: string
  tags: string[]
  last_updated: string
  uuid: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function newResourceUuid(): string {
  return crypto.randomUUID()
}

/** Local datetime `YYYY-MM-DD HH:MM:SS`. */
export function formatMetaTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Parse `YYYY-MM-DD HH:MM:SS` (or ISO) into an ISO string for UI sorting. */
export function metaTimestampToIso(value: string | null | undefined): string | null {
  if (!value || !String(value).trim()) return null
  const raw = String(value).trim()
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  )
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    )
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return null
}

function asString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    if (trimmed) return [trimmed]
  }
  return []
}

/** Read nested `metadata` or flattened legacy keys from parsed frontmatter. */
export function extractResourceMeta(
  frontmatter: Record<string, unknown>
): Partial<ResourceMeta> {
  const nested =
    frontmatter.metadata && typeof frontmatter.metadata === 'object'
      ? (frontmatter.metadata as Record<string, unknown>)
      : frontmatter

  const uuid = asString(nested.uuid)
  const last_updated = asString(nested.last_updated)
  const version = asString(nested.version)
  const author = asString(nested.author)
  const tags = asStringArray(nested.tags)

  const out: Partial<ResourceMeta> = {}
  if (uuid && UUID_RE.test(uuid)) out.uuid = uuid
  if (last_updated) out.last_updated = last_updated
  if (version) out.version = version
  if (author) out.author = author
  if (tags.length > 0) out.tags = tags
  return out
}

export function extractHookMeta(
  entry: Record<string, unknown>
): Partial<ResourceMeta> {
  return extractResourceMeta(entry)
}

const LAST_UPDATED_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const SEMVER_RE = /^\d+\.\d+\.\d+$/

function hasNestedMetadata(frontmatter: Record<string, unknown>): boolean {
  return (
    frontmatter.metadata != null &&
    typeof frontmatter.metadata === 'object' &&
    !Array.isArray(frontmatter.metadata)
  )
}

/** True when metadata block has all required fields in the expected shapes. */
export function isCompleteResourceMeta(meta: Partial<ResourceMeta>): boolean {
  if (!meta.uuid || !UUID_RE.test(meta.uuid)) return false
  if (!meta.last_updated || !LAST_UPDATED_RE.test(meta.last_updated)) return false
  if (!meta.version || !SEMVER_RE.test(meta.version.replace(/^["']|["']$/g, ''))) return false
  if (!meta.author || !meta.author.trim()) return false
  // tags must be present as an array (may be empty)
  if (!Array.isArray(meta.tags)) return false
  return true
}

export function validateSkillStructure(frontmatter: Record<string, unknown>): {
  ok: boolean
  reason: string
} {
  if (!asString(frontmatter.name)) {
    return { ok: false, reason: 'Missing name' }
  }
  if (frontmatter.description === undefined) {
    return { ok: false, reason: 'Missing description' }
  }
  if (frontmatter['disable-model-invocation'] === undefined) {
    return { ok: false, reason: 'Missing disable-model-invocation' }
  }
  if (!hasNestedMetadata(frontmatter)) {
    return { ok: false, reason: 'Missing nested metadata block' }
  }
  const meta = extractResourceMeta(frontmatter)
  // tags: extractResourceMeta omits empty arrays — read nested directly
  const nested = frontmatter.metadata as Record<string, unknown>
  const tags = asStringArray(nested.tags)
  const complete = isCompleteResourceMeta({ ...meta, tags })
  if (!complete) {
    return { ok: false, reason: 'Incomplete metadata (version, author, tags, last_updated, uuid)' }
  }
  return { ok: true, reason: '' }
}

export function validateRuleStructure(frontmatter: Record<string, unknown>): {
  ok: boolean
  reason: string
} {
  if (frontmatter.description === undefined) {
    return { ok: false, reason: 'Missing description' }
  }
  if (frontmatter.globs === undefined) {
    return { ok: false, reason: 'Missing globs' }
  }
  if (frontmatter.alwaysApply === undefined) {
    return { ok: false, reason: 'Missing alwaysApply' }
  }
  if (!hasNestedMetadata(frontmatter)) {
    return { ok: false, reason: 'Missing nested metadata block' }
  }
  const nested = frontmatter.metadata as Record<string, unknown>
  const meta = extractResourceMeta(frontmatter)
  const tags = asStringArray(nested.tags)
  const complete = isCompleteResourceMeta({ ...meta, tags })
  if (!complete) {
    return { ok: false, reason: 'Incomplete metadata (version, author, tags, last_updated, uuid)' }
  }
  return { ok: true, reason: '' }
}

export function validateSubAgentStructure(frontmatter: Record<string, unknown>): {
  ok: boolean
  reason: string
} {
  if (!asString(frontmatter.name)) {
    return { ok: false, reason: 'Missing name' }
  }
  if (frontmatter.description === undefined) {
    return { ok: false, reason: 'Missing description' }
  }
  if (!hasNestedMetadata(frontmatter)) {
    return { ok: false, reason: 'Missing nested metadata block' }
  }
  const nested = frontmatter.metadata as Record<string, unknown>
  const meta = extractResourceMeta(frontmatter)
  const tags = asStringArray(nested.tags)
  const complete = isCompleteResourceMeta({ ...meta, tags })
  if (!complete) {
    return { ok: false, reason: 'Incomplete metadata (version, author, tags, last_updated, uuid)' }
  }
  return { ok: true, reason: '' }
}

export function validateHookStructure(entry: Record<string, unknown>): {
  ok: boolean
  reason: string
} {
  if (!asString(entry.command)) {
    return { ok: false, reason: 'Missing command' }
  }
  if (entry.type === undefined) {
    return { ok: false, reason: 'Missing type' }
  }
  const meta = extractHookMeta(entry)
  const tags = asStringArray(entry.tags)
  const complete = isCompleteResourceMeta({
    ...meta,
    tags,
    version: asString(entry.version) || meta.version,
    author: asString(entry.author) || meta.author
  })
  if (!complete) {
    return {
      ok: false,
      reason: 'Incomplete metadata (version, author, tags, last_updated, uuid)'
    }
  }
  return { ok: true, reason: '' }
}

export function ensureResourceMeta(
  partial: Partial<ResourceMeta> | undefined,
  defaults?: { tags?: string[]; version?: string; author?: string }
): ResourceMeta {
  return {
    version: partial?.version?.trim() || defaults?.version || '1.0.0',
    author: partial?.author?.trim() || defaults?.author || 'Armin Dashti',
    tags: partial?.tags?.length ? partial.tags : defaults?.tags ?? [],
    last_updated: partial?.last_updated?.trim() || formatMetaTimestamp(),
    uuid: partial?.uuid && UUID_RE.test(partial.uuid) ? partial.uuid : newResourceUuid()
  }
}

function yamlScalar(value: string): string {
  if (value === '') return ''
  if (/[:#\[\]{},&*?|>!%@`]/.test(value) || /\s/.test(value) || value.includes("'") || value.includes('"')) {
    return JSON.stringify(value)
  }
  return value
}

function formatTags(tags: string[]): string {
  if (tags.length === 0) return '[]'
  return `[${tags.join(', ')}]`
}

export function serializeMetadataBlock(meta: ResourceMeta, indent = ''): string {
  const lines = [
    `${indent}metadata:`,
    `${indent}  version: ${yamlScalar(meta.version)}`,
    `${indent}  author: ${yamlScalar(meta.author)}`,
    `${indent}  tags: ${formatTags(meta.tags)}`,
    `${indent}  last_updated: ${yamlScalar(meta.last_updated)}`,
    `${indent}  uuid: ${meta.uuid}`
  ]
  return lines.join('\n')
}

export function skillTemplate(
  name: string,
  options?: {
    description?: string
    tags?: string[]
    meta?: Partial<ResourceMeta>
  }
): string {
  const meta = ensureResourceMeta(options?.meta, {
    tags: options?.tags ?? [],
    version: '1.0.0',
    author: 'Armin Dashti'
  })
  const description = (options?.description ?? '').trim()
  const descriptionBlock = description
    ? `description: >-\n  ${description.split(/\r?\n/).join('\n  ')}`
    : 'description: >-\n  '

  return `---
name: ${name}
${descriptionBlock}
disable-model-invocation: false
${serializeMetadataBlock(meta)}
---

# ${name}

Describe what this skill does.
`
}

export function ruleTemplate(
  name: string,
  options?: {
    description?: string
    tags?: string[]
    meta?: Partial<ResourceMeta>
  }
): string {
  const meta = ensureResourceMeta(options?.meta, {
    tags: options?.tags ?? [],
    version: '1.0.0',
    author: 'Armin Dashti'
  })
  const description = (options?.description ?? '').trim()
  const descriptionBlock = description
    ? `description: >-\n  ${description.split(/\r?\n/).join('\n  ')}`
    : 'description: >-\n  '

  return `---
${descriptionBlock}
globs:
alwaysApply: false
${serializeMetadataBlock(meta)}
---

# ${name}
`
}

export function subAgentTemplate(
  name: string,
  options?: {
    description?: string
    tags?: string[]
    meta?: Partial<ResourceMeta>
  }
): string {
  const meta = ensureResourceMeta(options?.meta, {
    tags: options?.tags ?? [],
    version: '1.0.0',
    author: 'Armin Dashti'
  })
  const description = (options?.description ?? '').trim()
  const descriptionBlock = description
    ? `description: >-\n  ${description.split(/\r?\n/).join('\n  ')}`
    : 'description: >-\n  '

  return `---
name: ${name}
${descriptionBlock}
model: inherit
${serializeMetadataBlock(meta)}
---

You are a sub-agent specialized in ${name}.
`
}

export function hookEntryTemplate(
  name: string,
  options?: {
    event?: string
    tags?: string[]
    meta?: Partial<ResourceMeta>
  }
): Record<string, unknown> {
  const meta = ensureResourceMeta(options?.meta, {
    tags: options?.tags ?? [],
    version: '1.0.0',
    author: 'Armin Dashti'
  })
  return {
    command: `hooks/${name}.sh`,
    type: 'command',
    version: meta.version,
    author: meta.author,
    tags: meta.tags,
    last_updated: meta.last_updated,
    uuid: meta.uuid
  }
}

/** Merge metadata into existing markdown frontmatter text; preserves body. */
export function upsertMarkdownMeta(
  content: string,
  meta: ResourceMeta,
  topLevel?: Record<string, unknown>
): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  const body = match ? match[2] : content

  const existingTop: Record<string, unknown> = { ...(topLevel ?? {}) }
  // Prefer explicit top-level overrides; callers usually pass name/description/etc.
  const name = asString(existingTop.name)
  const description = existingTop.description
  const disableModel = existingTop['disable-model-invocation']
  const globs = existingTop.globs
  const alwaysApply = existingTop.alwaysApply
  const model = existingTop.model

  const lines: string[] = ['---']
  if (name) lines.push(`name: ${name}`)
  if (description !== undefined) {
    const desc = asString(description)
    if (desc.includes('\n') || desc.length > 60) {
      lines.push('description: >-')
      for (const part of desc.split(/\r?\n/)) {
        lines.push(`  ${part}`)
      }
    } else {
      lines.push(`description: ${desc}`)
    }
  }
  if (disableModel !== undefined) {
    lines.push(`disable-model-invocation: ${disableModel === false ? 'false' : 'true'}`)
  }
  if (globs !== undefined) lines.push(`globs: ${asString(globs)}`)
  if (alwaysApply !== undefined) {
    lines.push(`alwaysApply: ${alwaysApply === true ? 'true' : 'false'}`)
  }
  if (model !== undefined) lines.push(`model: ${asString(model)}`)
  lines.push(serializeMetadataBlock(meta))
  lines.push('---')
  lines.push('')
  return `${lines.join('\n')}${body.replace(/^\r?\n/, '')}`
}
