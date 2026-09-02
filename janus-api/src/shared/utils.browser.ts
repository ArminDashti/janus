export function isMarkdownFile(path: string): boolean {
  return /\.(md|mdc)$/i.test(path)
}

const BLOCK_SCALAR_RE = /^(>|>-|\||\|-)\s*$/

function isIndentedContinuation(line: string): boolean {
  return line.length > 0 && /^\s/.test(line)
}

function joinBlockScalar(style: string, lines: string[]): string {
  const trimmed = lines.map((l) => l.replace(/^\s+/, ''))
  if (style.startsWith('>')) {
    return trimmed.join(' ').replace(/\s+/g, ' ').trim()
  }
  return trimmed.join('\n').trim()
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/)
  return m ? m[1].length : 0
}

function parseInlineArray(raw: string): string[] | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null
  const inner = trimmed.slice(1, -1).trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0)
}

function coerceScalar(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  const arr = parseInlineArray(value)
  if (arr) return arr
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function parseNestedBlock(
  lines: string[],
  startIndex: number,
  parentIndent: number
): { value: Record<string, unknown>; nextIndex: number } {
  const obj: Record<string, unknown> = {}
  let i = startIndex

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const indent = indentOf(line)
    if (indent <= parentIndent) break

    const trimmed = line.trim()
    const idx = trimmed.indexOf(':')
    if (idx === -1) {
      i++
      continue
    }

    const key = trimmed.slice(0, idx).trim()
    let valueRaw = trimmed.slice(idx + 1).trim()

    if (!key) {
      i++
      continue
    }

    if (!valueRaw) {
      // Nested object under this key
      const nested = parseNestedBlock(lines, i + 1, indent)
      obj[key] = nested.value
      i = nested.nextIndex
      continue
    }

    if (BLOCK_SCALAR_RE.test(valueRaw)) {
      const style = valueRaw
      const blockLines: string[] = []
      i++
      while (i < lines.length && isIndentedContinuation(lines[i]) && indentOf(lines[i]) > indent) {
        blockLines.push(lines[i])
        i++
      }
      obj[key] = joinBlockScalar(style, blockLines)
      continue
    }

    obj[key] = coerceScalar(valueRaw)
    i++
  }

  return { value: obj, nextIndex: i }
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatter: Record<string, unknown> = {}
  const lines = match[1].split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const indent = indentOf(line)
    const trimmed = line.trim()
    const idx = trimmed.indexOf(':')
    if (idx === -1) {
      i++
      continue
    }

    const key = trimmed.slice(0, idx).trim()
    if (!key) {
      i++
      continue
    }

    let valueRaw = trimmed.slice(idx + 1).trim()

    if (!valueRaw) {
      const nested = parseNestedBlock(lines, i + 1, indent)
      frontmatter[key] = nested.value
      i = nested.nextIndex
      continue
    }

    if (BLOCK_SCALAR_RE.test(valueRaw)) {
      const style = valueRaw
      const blockLines: string[] = []
      i++
      while (i < lines.length && isIndentedContinuation(lines[i])) {
        blockLines.push(lines[i])
        i++
      }
      frontmatter[key] = joinBlockScalar(style, blockLines)
      continue
    }

    frontmatter[key] = coerceScalar(valueRaw)
    i++
  }

  return { frontmatter, body: match[2] }
}

/** Nested skills use first path segment; flat skills use first segment before `-`. */
export function defaultCategoryFromName(name: string): string {
  const normalized = name.replace(/\\/g, '/')
  if (normalized.includes('/')) {
    return normalized.split('/')[0]?.trim() ?? ''
  }
  const idx = name.indexOf('-')
  if (idx <= 0) return ''
  return name.slice(0, idx).trim()
}

export function formatDateWithRelative(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return `${formatted} (today)`
  if (diffDays === 1) return `${formatted} (1 day ago)`
  return `${formatted} (${diffDays} days ago)`
}

export function isValidGithubUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com'
  } catch {
    return false
  }
}

export function skillGroupKey(name: string, contentHash: string): string {
  return `${name}::${contentHash}`
}

/** Parse `name::contentHash` group keys; returns null for bare folder names. */
export function parseSkillGroupKey(
  key: string
): { name: string; contentHash: string } | null {
  const sep = key.lastIndexOf('::')
  if (sep <= 0) return null
  const contentHash = key.slice(sep + 2).toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(contentHash)) return null
  return { name: key.slice(0, sep), contentHash }
}

export function skillFolderNameFromKey(key: string): string {
  return parseSkillGroupKey(key)?.name ?? key
}
