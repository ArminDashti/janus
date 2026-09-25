import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Search, Share2, Trash } from 'lucide-react'
import type { ResourceGroupSummary, RuleResource, UiSearchField } from '@shared/types'
import { cn } from '@renderer/lib/utils'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { ProjectPanel } from '@renderer/components/resources/ProjectPanel'
import {
  AddResourceModal,
  isCreatableResourceType
} from '@renderer/components/resources/AddResourceModal'
import { ThreePanelLayout } from '@renderer/components/layout/ThreePanelLayout'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

function ruleDisplayName(name: string): string {
  return name.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? name
}

function fileBaseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
}

// ─── Left: rule list (search + row delete + apply-all) ──────────────────────

interface RuleListProps {
  rules: ResourceGroupSummary[]
  loading: boolean
  selectedName: string | null
  onSelect: (name: string) => void
  onDelete: (row: ResourceGroupSummary) => void
  onAdd: () => void
  onApplyAll: () => void
  search: string
  onSearch: (v: string) => void
  searchField: UiSearchField
  onSearchFieldChange: (f: UiSearchField) => void
}

const SEARCH_FIELD_OPTIONS: { value: UiSearchField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'tags', label: 'Tags' },
  { value: 'category', label: 'Category' }
]

function RuleList({
  rules,
  loading,
  selectedName,
  onSelect,
  onDelete,
  onAdd,
  onApplyAll,
  search,
  onSearch,
  searchField,
  onSearchFieldChange
}: RuleListProps) {
  return (
    <aside className="w-full h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-zinc-400">Rules · {rules.length}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onApplyAll}
              className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800"
              title="Apply all rules to every project"
            >
              <Share2 size={13} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onAdd}
              className="p-1 rounded text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"
              title="Add rule"
            >
              <Plus size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Filter rules…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 pl-6 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <select
            value={searchField}
            onChange={(e) => onSearchFieldChange(e.target.value as UiSearchField)}
            aria-label="Search field"
            title="Search in"
            className="shrink-0 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1.5 text-xs text-zinc-300 cursor-pointer hover:bg-zinc-800 focus:outline-none focus:border-zinc-500"
          >
            {SEARCH_FIELD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {loading && rules.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">No rules found</p>
        ) : (
          rules.map((r) => {
            const key = r.groupKey || r.name
            const isSelected = key === selectedName
            return (
              <div
                key={key}
                className={cn(
                  'group flex items-center border-l-2 transition-colors',
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'border-transparent hover:bg-zinc-800'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  className={cn(
                    'flex-1 min-w-0 text-left px-3 py-2 text-xs truncate flex items-center gap-1.5',
                    isSelected ? 'text-blue-300' : 'text-zinc-300'
                  )}
                  title={r.name}
                >
                  <span className="truncate">{ruleDisplayName(r.name)}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(r)
                  }}
                  className="p-1.5 mr-1 rounded text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-zinc-700/60 transition-opacity"
                  title={`Delete ${ruleDisplayName(r.name)}`}
                >
                  <Trash size={12} strokeWidth={1.75} />
                </button>
              </div>
            )
          })
        )}
      </nav>
    </aside>
  )
}

// ─── Right: rule content (.mdc) ─────────────────────────────────────────────

interface RuleContentProps {
  ruleName: string | null
}

function RuleContent({ ruleName }: RuleContentProps) {
  const [resource, setResource] = useState<RuleResource | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async (name: string) => {
    setLoading(true)
    setNotFound(false)
    try {
      const canonical = await window.agentManager.getCanonicalResource('rule', name)
      if (!canonical) {
        setResource(null)
        setNotFound(true)
        return
      }
      const rule = canonical as RuleResource
      setResource(rule)
      const file = rule.filePath || ''
      setFilePath(file || null)
      setContent(file ? await window.agentManager.readFile(file) : '')
    } catch {
      setResource(null)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ruleName) void load(ruleName)
    else {
      setResource(null)
      setFilePath(null)
      setContent('')
      setNotFound(false)
    }
  }, [ruleName, load])

  const saveFile = async (value: string) => {
    if (!filePath) return
    const confirmed = await showMessage({
      message: `Save changes to ${fileBaseName(filePath)}?`,
      confirm: true
    })
    if (!confirmed) return
    await window.agentManager.writeFile(filePath, value)
  }

  if (!ruleName) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
        <FileText size={24} className="text-zinc-600" />
        <p className="text-sm text-zinc-500">Select a rule to view its content</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        Loading rule content…
      </div>
    )
  }

  if (notFound || !resource) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        Rule content not found
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 p-3 overflow-hidden">
        {!filePath ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Select a file
          </div>
        ) : (
          <MarkdownEditor
            key={filePath}
            filePath={filePath}
            value={content}
            onChange={setContent}
            onSave={(v) => saveFile(v)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main RulesPage: three-pane layout (same shape as SkillsPage) ───────────

export function RulesPage() {
  const { refreshScan } = useAppStore()
  const [rules, setRules] = useState<ResourceGroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState<UiSearchField>('name')
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      const soft = opts?.soft && rules.length > 0
      if (!soft) setLoading(true)
      try {
        const stats = await window.agentManager.getResourceStats('rule')
        setRules(stats)
        if (!soft && stats.length > 0) {
          setSelected((prev) => prev ?? (stats[0].groupKey || stats[0].name))
        }
      } finally {
        if (!soft) setLoading(false)
      }
    },
    [rules.length]
  )

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
      ? rules.filter((r) => {
          const haystack =
            searchField === 'tags'
              ? (r.tags ?? []).join(' ')
              : searchField === 'category'
                ? (r.category ?? '')
                : `${r.name} ${r.description}`
          return haystack.toLowerCase().includes(q)
        })
      : rules
    return [...list].sort((a, b) =>
      ruleDisplayName(a.name).localeCompare(ruleDisplayName(b.name))
    )
  }, [rules, search, searchField])

  const handleDelete = useCallback(
    async (row: ResourceGroupSummary) => {
      const key = row.groupKey || row.name
      const confirmed = await showMessage({
        message: `Delete "${ruleDisplayName(row.name)}" from all locations? Items are kept under .trash.`,
        confirm: true,
        type: 'error',
        title: 'Delete rule'
      })
      if (!confirmed) return
      try {
        await window.agentManager.deleteResource('rule', key)
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

  const handleApplyAll = useCallback(async () => {
    const confirmed = await showMessage({
      message: 'Apply every rule to all projects?',
      confirm: true
    })
    if (!confirmed) return
    try {
      const count = await window.agentManager.applyAllToAllProjects('rule')
      await load({ soft: true })
      refreshScan()
      await showMessage({ message: `Applied ${count} rule(s) to all projects`, type: 'success' })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Apply all failed',
        type: 'error'
      })
    }
  }, [load, refreshScan])

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ThreePanelLayout
        autoSaveId="rules-three-panel-v1"
        defaultLeftSize={22}
        defaultMiddleSize={24}
        left={
          <RuleList
            rules={filtered}
            loading={loading}
            selectedName={selected}
            onSelect={setSelected}
            onDelete={(row) => void handleDelete(row)}
            onAdd={() => setAddOpen(true)}
            onApplyAll={() => void handleApplyAll()}
            search={search}
            onSearch={setSearch}
            searchField={searchField}
            onSearchFieldChange={setSearchField}
          />
        }
        middle={
          <ProjectPanel
            resourceType="rule"
            resourceName={selected}
            resourceLabel="rule"
            onRefresh={() => void refreshScan()}
          />
        }
        right={<RuleContent ruleName={selected} />}
      />
      {addOpen && isCreatableResourceType('rule') && (
        <AddResourceModal
          resourceType="rule"
          onClose={() => setAddOpen(false)}
          onCreated={(name) => {
            void refreshScan()
            void load({ soft: true })
            if (name) setSelected(name)
          }}
        />
      )}
    </div>
  )
}
