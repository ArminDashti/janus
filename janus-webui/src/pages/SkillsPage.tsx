import { useCallback, useEffect, useMemo, useState } from 'react'
import { File, FileCode, FileJson, FileText, Trash } from 'lucide-react'
import type { ResourceGroupSummary, SkillResource, UiSearchField } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { ProjectPanel } from '@renderer/components/resources/ProjectPanel'
import { BrowserColumn, browserRowClass } from '@renderer/components/layout/BrowserColumn'
import { ThreePanelLayout } from '@renderer/components/layout/ThreePanelLayout'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { isMarkdownFile } from '@shared/utils.browser'

// ─── helpers ────────────────────────────────────────────────────────────────

function skillDisplayName(name: string): string {
  return name.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? name
}

function fileBaseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
}

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'sh', 'bash', 'zsh', 'ps1',
  'yaml', 'yml', 'toml', 'jsonc', 'css', 'scss', 'html', 'sql', 'rb', 'go', 'rs'
])

/** Icon for a skill file tab based on its extension. */
function fileIcon(path: string): typeof File {
  const ext = fileBaseName(path).split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'md' || ext === 'mdx') return FileText
  if (ext === 'json') return FileJson
  if (CODE_EXTENSIONS.has(ext)) return FileCode
  return File
}

// ─── Left: skill list ───────────────────────────────────────────────────────

interface SkillListProps {
  skills: ResourceGroupSummary[]
  loading: boolean
  selectedName: string | null
  onSelect: (name: string) => void
  onDelete: (row: ResourceGroupSummary) => void
  search: string
  onSearch: (v: string) => void
  searchField: UiSearchField
  onSearchFieldChange: (f: UiSearchField) => void
}

function SkillList({
  skills,
  loading,
  selectedName,
  onSelect,
  onDelete,
  search,
  onSearch,
  searchField,
  onSearchFieldChange
}: SkillListProps) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const shown = sortDir === 'asc' ? skills : [...skills].reverse()

  return (
    <BrowserColumn
      title="Skills"
      countLabel={String(skills.length)}
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Search skills..."
      nameHeader={{
        searchField,
        onSearchFieldChange,
        sortDir,
        onToggleSort: () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      }}
    >
      {loading && skills.length === 0 ? (
        <p className="px-3 py-4 text-xs text-zinc-500 text-center">Loading…</p>
      ) : skills.length === 0 ? (
        <p className="px-3 py-4 text-xs text-zinc-500 text-center">No skills found</p>
      ) : (
        shown.map((s) => {
          const key = skillDisplayName(s.name)
          const isSelected = key === selectedName
          return (
            <div key={key} className={browserRowClass(isSelected)}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                className="flex-1 min-w-0 text-left px-2.5 py-1.5 text-[13px] truncate"
                title={s.name}
              >
                {skillDisplayName(s.name)}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(s)
                }}
                className={cn(
                  'p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                  isSelected
                    ? 'text-white/70 hover:text-white hover:bg-white/10'
                    : 'text-zinc-600 hover:text-red-400 hover:bg-zinc-700/60'
                )}
                title={`Delete ${skillDisplayName(s.name)}`}
              >
                <Trash size={12} strokeWidth={1.75} />
              </button>
            </div>
          )
        })
      )}
    </BrowserColumn>
  )
}

// ─── Right: skill content ───────────────────────────────────────────────────

interface SkillContentProps {
  skillName: string | null
}

export function SkillContent({ skillName }: SkillContentProps) {
  const [resource, setResource] = useState<SkillResource | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async (name: string) => {
    setLoading(true)
    setNotFound(false)
    try {
      const canonical = await window.agentManager.getCanonicalResource('skill', name)
      if (!canonical) {
        setResource(null)
        setNotFound(true)
        return
      }
      const skill = canonical as SkillResource
      setResource(skill)
      const file = skill.skillMdPath || skill.files[0] || ''
      setSelectedFile(file || null)
      setContent(file ? await window.agentManager.readFile(file) : '')
    } catch {
      setResource(null)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skillName) void load(skillName)
    else {
      setResource(null)
      setSelectedFile(null)
      setContent('')
      setNotFound(false)
    }
  }, [skillName, load])

  const openFile = async (path: string) => {
    setSelectedFile(path)
    setContent(await window.agentManager.readFile(path))
  }

  const saveFile = async (filePath: string, value: string) => {
    const confirmed = await showMessage({
      message: `Save changes to ${fileBaseName(filePath)}?`,
      confirm: true
    })
    if (!confirmed) return
    const isSkillMd = fileBaseName(filePath) === 'SKILL.md'
    if (isSkillMd && skillName) {
      const { filePath: savedPath } = await window.agentManager.writeSkillMd(
        filePath,
        value,
        skillName
      )
      if (savedPath !== filePath) setSelectedFile(savedPath)
    } else {
      await window.agentManager.writeFile(filePath, value)
    }
  }

  if (!skillName) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
        <FileText size={24} className="text-zinc-600" />
        <p className="text-sm text-zinc-500">Select a skill to view its content</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        Loading skill content…
      </div>
    )
  }

  if (notFound || !resource) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        Skill content not found
      </div>
    )
  }

  const files = resource.files ?? []
  const editable =
    selectedFile != null && (isMarkdownFile(selectedFile) || selectedFile.endsWith('.py'))

  return (
    <div className="h-full flex flex-col min-h-0">
      {files.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-surface-border overflow-x-auto shrink-0 bg-surface">
          {files.map((f) => {
            const Icon = fileIcon(f)
            return (
              <button
                key={f}
                type="button"
                onClick={() => void openFile(f)}
                title={f}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-[13px] rounded whitespace-nowrap transition-colors',
                  f === selectedFile
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                )}
              >
                <Icon size={12} className="shrink-0" />
                {fileBaseName(f)}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {!selectedFile ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Select a file
          </div>
        ) : editable ? (
          <MarkdownEditor
            key={selectedFile}
            filePath={selectedFile}
            value={content}
            onChange={setContent}
            onSave={(v) => saveFile(selectedFile, v)}
          />
        ) : (
          <pre className="h-full overflow-auto text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg p-3 whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}

// ─── Main SkillsPage: three-pane layout ─────────────────────────────────────

export function SkillsPage() {
  const { refreshScan } = useAppStore()
  const [skills, setSkills] = useState<ResourceGroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState<UiSearchField>('name')

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft && skills.length > 0
    if (!soft) setLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats('skill')
      setSkills(stats)
      // Auto-select first skill on initial load
      if (!soft && stats.length > 0) {
        setSelected((prev) => prev ?? skillDisplayName(stats[0].name))
      }
    } finally {
      if (!soft) setLoading(false)
    }
  }, [skills.length])

  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => void load({ soft: true })
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? skills.filter((s) => {
          const haystack =
            searchField === 'tags'
              ? (s.tags ?? []).join(' ')
              : searchField === 'category'
                ? (s.category ?? '')
                : `${s.name} ${s.description}`
          return haystack.toLowerCase().includes(q)
        })
      : skills
    return [...list].sort((a, b) =>
      skillDisplayName(a.name).localeCompare(skillDisplayName(b.name))
    )
  }, [skills, search, searchField])

  const handleDelete = useCallback(
    async (row: ResourceGroupSummary) => {
      const key = skillDisplayName(row.name)
      const confirmed = await showMessage({
        message: `Delete "${skillDisplayName(row.name)}" from all locations? Items are kept under .trash.`,
        confirm: true,
        type: 'error',
        title: 'Delete skill'
      })
      if (!confirmed) return
      try {
        await window.agentManager.deleteResource('skill', key)
        if (key === selected) setSelected(null)
        await load({ soft: true })
        refreshScan()
      } catch (e) {
        await showMessage({
          message: e instanceof Error ? e.message : 'Delete failed',
          type: 'error'
        })
      }
    },
    [selected, load, refreshScan]
  )

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ThreePanelLayout
        autoSaveId="skills-three-panel-v2"
        defaultLeftSize={22}
        defaultMiddleSize={24}
        left={
          <SkillList
            skills={filtered}
            loading={loading}
            selectedName={selected}
            onSelect={setSelected}
            onDelete={(row) => void handleDelete(row)}
            search={search}
            onSearch={setSearch}
            searchField={searchField}
            onSearchFieldChange={setSearchField}
          />
        }
        middle={
          <ProjectPanel
            resourceType="skill"
            resourceName={selected}
            resourceLabel="skill"
            onRefresh={() => void refreshScan()}
            onRemovedFromAllProjects={() => {
              setSelected(null)
              void load({ soft: true })
            }}
          />
        }
        right={<SkillContent skillName={selected} />}
      />
    </div>
  )
}
