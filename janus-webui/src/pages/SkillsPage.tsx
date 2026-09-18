import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, FolderGit2, FileText } from 'lucide-react'
import type { ProjectMatrixRow, ResourceGroupSummary, SkillResource } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { Toggle } from '@renderer/components/Toggle'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
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

// ─── Left: skill list ───────────────────────────────────────────────────────

interface SkillListProps {
  skills: ResourceGroupSummary[]
  loading: boolean
  selectedName: string | null
  onSelect: (name: string) => void
  search: string
  onSearch: (v: string) => void
}

function SkillList({ skills, loading, selectedName, onSelect, search, onSearch }: SkillListProps) {
  return (
    <aside className="w-full h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800">
        <h2 className="text-xs font-medium text-zinc-400 mb-2">Skills · {skills.length}</h2>
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Filter skills…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 pl-6 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {loading && skills.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">Loading…</p>
        ) : skills.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">No skills found</p>
        ) : (
          skills.map((s) => (
            <button
              key={s.groupKey || s.name}
              type="button"
              onClick={() => onSelect(s.groupKey || s.name)}
              className={cn(
                'w-full text-left px-3 py-2 text-xs transition-colors truncate',
                (s.groupKey || s.name) === selectedName
                  ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500'
                  : 'text-zinc-300 hover:bg-zinc-800 border-l-2 border-transparent'
              )}
              title={s.name}
            >
              {skillDisplayName(s.name)}
            </button>
          ))
        )}
      </nav>
    </aside>
  )
}

// ─── Middle: project/repo assignment list ───────────────────────────────────

interface ProjectPanelProps {
  skillName: string | null
  onRefresh?: () => void
}

function ProjectPanel({ skillName, onRefresh }: ProjectPanelProps) {
  const [rows, setRows] = useState<ProjectMatrixRow[]>([])
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [projectSearch, setProjectSearch] = useState('')

  const load = useCallback(async (name: string) => {
    setLoading(true)
    setPending({})
    try {
      const matrix = await window.agentManager.getProjectMatrix('skill', name)
      setRows(matrix)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skillName) void load(skillName)
    else { setRows([]); setPending({}) }
  }, [skillName, load])

  useEffect(() => {
    setProjectSearch('')
  }, [skillName])

  const effectiveAssigned = useMemo(() => {
    const base: Record<string, boolean> = {}
    for (const r of rows) base[r.projectId] = r.assigned
    for (const [id, val] of Object.entries(pending)) base[id] = val
    return base
  }, [rows, pending])

  const assignedCount = useMemo(
    () => Object.values(effectiveAssigned).filter(Boolean).length,
    [effectiveAssigned]
  )

  const toggle = async (projectId: string) => {
    if (!skillName) return
    const next = !effectiveAssigned[projectId]

    // Prevent removing all assignments
    const nextCount = Object.values({ ...effectiveAssigned, [projectId]: next }).filter(Boolean).length
    if (nextCount === 0) {
      await showMessage({ message: 'At least one project must be assigned.', type: 'error' })
      return
    }

    setPending((p) => ({ ...p, [projectId]: next }))
    setSaving(projectId)
    try {
      const allAssigned = { ...effectiveAssigned, [projectId]: next }
      const assignedIds = Object.entries(allAssigned).filter(([, v]) => v).map(([k]) => k)
      await window.agentManager.applyProjectAssignment('skill', skillName, assignedIds)
      const mandatory = assignedIds.length === rows.length
      await window.agentManager.setMandatory('skill', skillName, mandatory)
      onRefresh?.()
      // Sync rows so future toggles have correct base
      setRows((prev) => prev.map((r) => r.projectId === projectId ? { ...r, assigned: next } : r))
      setPending((p) => { const n = { ...p }; delete n[projectId]; return n })
    } catch (e) {
      // Revert optimistic update
      setPending((p) => { const n = { ...p }; delete n[projectId]; return n })
      await showMessage({ message: e instanceof Error ? e.message : 'Save failed', type: 'error' })
    } finally {
      setSaving(null)
    }
  }

  const visibleRows = useMemo(() => {
    const q = projectSearch.trim().toLowerCase()
    const sorted = [...rows].sort((a, b) => a.projectName.localeCompare(b.projectName))
    if (!q) return sorted
    return sorted.filter((r) => r.projectName.toLowerCase().includes(q))
  }, [rows, projectSearch])

  return (
    <aside className="w-full h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800">
        <h2 className="text-xs font-medium text-zinc-400">
          Projects · {assignedCount}/{rows.length}
        </h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">Toggle to assign / unassign</p>
        <div className="relative mt-2">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Filter projects…"
            disabled={!skillName}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 pl-6 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {!skillName ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <FolderGit2 size={20} className="text-zinc-600" />
            <p className="text-xs text-zinc-500">Select a skill to manage project assignments</p>
          </div>
        ) : loading ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">Loading projects…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">
            No projects configured. Add project roots in Settings → Projects.
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">No projects match filter</p>
        ) : (
          visibleRows.map((row) => {
            const assigned = effectiveAssigned[row.projectId] ?? false
            const isSaving = saving === row.projectId
            return (
              <div
                key={row.projectId}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 mx-1 rounded-md transition-colors',
                  assigned ? 'bg-zinc-900' : 'hover:bg-zinc-800/60'
                )}
                title={row.projectName}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      assigned ? 'bg-emerald-500' : 'bg-zinc-600'
                    )}
                  />
                  <span className="text-xs text-zinc-200 truncate">{row.projectName}</span>
                </span>
                {isSaving ? (
                  <RefreshCw size={14} className="animate-spin text-zinc-500 shrink-0" />
                ) : (
                  <Toggle
                    checked={assigned}
                    onChange={() => void toggle(row.projectId)}
                    title={assigned ? `Unassign from ${row.projectName}` : `Assign to ${row.projectName}`}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

// ─── Right: skill content ───────────────────────────────────────────────────

interface SkillContentProps {
  skillName: string | null
  summary: ResourceGroupSummary | null
}

function SkillContent({ skillName, summary }: SkillContentProps) {
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
    else { setResource(null); setSelectedFile(null); setContent(''); setNotFound(false) }
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
      await window.agentManager.writeSkillMd(filePath, value, skillName)
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
  const editable = selectedFile != null && (isMarkdownFile(selectedFile) || selectedFile.endsWith('.py'))

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-zinc-200 truncate">
            {summary ? skillDisplayName(summary.name) : resource.name}
          </h2>
          {summary?.mandatory && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 shrink-0">
              All projects
            </span>
          )}
          {!resource.structureOk && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-300 shrink-0"
              title={resource.structureWarning ?? 'Invalid structure'}
            >
              Invalid structure
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 truncate" title={resource.rootPath}>
          {resource.rootPath}
        </p>
        {summary?.description && (
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{summary.description}</p>
        )}
        {resource.structureWarning && (
          <p className="text-[11px] text-amber-400/90 mt-1">{resource.structureWarning}</p>
        )}
      </header>

      {files.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b border-zinc-800 overflow-x-auto shrink-0">
          {files.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => void openFile(f)}
              title={f}
              className={cn(
                'px-2 py-1 text-[11px] rounded whitespace-nowrap transition-colors',
                f === selectedFile
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              )}
            >
              {fileBaseName(f)}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 p-3 overflow-hidden">
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

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft && skills.length > 0
    if (!soft) setLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats('skill')
      setSkills(stats)
      // Auto-select first skill on initial load
      if (!soft && stats.length > 0) {
        setSelected((prev) => prev ?? (stats[0].groupKey || stats[0].name))
      }
    } finally {
      if (!soft) setLoading(false)
    }
  }, [skills.length])

  useEffect(() => { void load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => void load({ soft: true })
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? skills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      : skills
    return [...list].sort((a, b) => skillDisplayName(a.name).localeCompare(skillDisplayName(b.name)))
  }, [skills, search])

  const selectedSummary = useMemo(
    () => skills.find((s) => (s.groupKey || s.name) === selected) ?? null,
    [skills, selected]
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
            search={search}
            onSearch={setSearch}
          />
        }
        middle={
          <ProjectPanel
            skillName={selected}
            onRefresh={() => void refreshScan()}
          />
        }
        right={
          <SkillContent
            skillName={selected}
            summary={selectedSummary}
          />
        }
      />
    </div>
  )
}
