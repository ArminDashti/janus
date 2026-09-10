import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderGit2 } from 'lucide-react'
import type { ProjectInfo, ResourceGroupSummary, UiFilterState } from '@shared/types'
import { ResourceListView } from '@renderer/components/resources/ResourceListView'
import { HooksListView } from '@renderer/components/resources/HooksListView'
import { ResourceEditView } from '@renderer/components/resources/ResourceEditView'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'
import type { ListableResourceType } from '@renderer/lib/filter-utils'

type RepoTab = 'skill' | 'rule' | 'hook' | 'subAgent' | 'tool'

const TABS: { id: RepoTab; label: string }[] = [
  { id: 'skill', label: 'Skills' },
  { id: 'rule', label: 'Rules' },
  { id: 'hook', label: 'Hooks' },
  { id: 'subAgent', label: 'Sub-agents' },
  { id: 'tool', label: 'Tools' }
]

function emptyFilter(projectId: string): UiFilterState {
  return {
    search: '',
    selectedProjectId: projectId,
    selectedCategories: [],
    sortKey: 'name',
    sortDir: 'asc'
  }
}

export function RepositoriesPage() {
  const { settings, setPage, refreshScan } = useAppStore()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [tab, setTab] = useState<RepoTab>('skill')
  const [filterState, setFilterState] = useState<UiFilterState>(() => emptyFilter(''))
  const [editName, setEditName] = useState<string | null>(null)

  const [hookSummaries, setHookSummaries] = useState<ResourceGroupSummary[]>([])
  const [hookLoading, setHookLoading] = useState(false)

  const projects = useMemo(
    () =>
      settings?.projectRoots
        .flatMap((r) => r.projects)
        .sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [settings]
  )

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null)
      return
    }
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) return
    setFilterState(emptyFilter(selectedProjectId))
    setEditName(null)
  }, [selectedProjectId])

  const selectedProject: ProjectInfo | undefined = projects.find((p) => p.id === selectedProjectId)

  const loadHooks = useCallback(async () => {
    setHookLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats('hook')
      setHookSummaries(stats)
    } finally {
      setHookLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'hook') return
    void loadHooks()
    const handler = () => void loadHooks()
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [tab, loadHooks])

  const handleFilterChange = (patch: Partial<UiFilterState>) => {
    setFilterState((prev) => ({
      ...prev,
      ...patch,
      // Keep project locked while browsing a repository
      selectedProjectId: selectedProjectId ?? prev.selectedProjectId
    }))
  }

  const handleHookRename = async (oldName: string, newName: string) => {
    try {
      await window.agentManager.renameResource('hook', oldName, newName)
      await loadHooks()
      await refreshScan()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Rename failed',
        type: 'error'
      })
    }
  }

  const handleHookDelete = async (name: string) => {
    const confirmed = await showMessage({
      message: `Delete "${name}" from all locations? Items are kept under .trash.`,
      confirm: true,
      type: 'error',
      title: 'Delete resource'
    })
    if (!confirmed) return
    await window.agentManager.deleteResource('hook', name)
    await loadHooks()
    await refreshScan()
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <FolderGit2 size={32} className="text-zinc-600" />
        <p className="text-zinc-300 font-medium">No repositories imported</p>
        <p className="text-sm text-zinc-500 max-w-sm">
          Import projects under Settings → Projects, then return here to browse Skills, Rules,
          Hooks, Sub-agents, and Tools per repository.
        </p>
        <button
          type="button"
          onClick={() => setPage('settings')}
          className="mt-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded"
        >
          Open Settings
        </button>
      </div>
    )
  }

  const listFilter = selectedProjectId
    ? { ...filterState, selectedProjectId }
    : filterState

  return (
    <div className="relative flex h-full min-h-0">
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900/40">
        <div className="px-3 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Repositories</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{projects.length} imported</p>
        </div>
        <nav className="flex-1 overflow-auto p-2 space-y-0.5">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              title={project.path}
              onClick={() => setSelectedProjectId(project.id)}
              className={cn(
                'w-full text-left px-2.5 py-2 rounded-md text-sm truncate transition-colors',
                selectedProjectId === project.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )}
            >
              {project.name}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-4 pt-3 border-b border-zinc-800">
          <div className="mb-2">
            <h2 className="text-lg font-medium text-zinc-100">{selectedProject?.name ?? 'Repository'}</h2>
            {selectedProject && (
              <p className="text-xs text-zinc-500 truncate" title={selectedProject.path}>
                {selectedProject.path}
              </p>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id)
                  setEditName(null)
                }}
                className={cn(
                  'px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {selectedProjectId && tab === 'hook' ? (
            <HooksListView
              summaries={hookSummaries}
              loading={hookLoading}
              filterState={listFilter}
              onFilterChange={handleFilterChange}
              onEdit={(name) => setEditName(name)}
              onRename={handleHookRename}
              onDelete={handleHookDelete}
              showProjectFilter={false}
              hideHeader
            />
          ) : selectedProjectId ? (
            <ResourceListView
              title={TABS.find((t) => t.id === tab)?.label ?? tab}
              resourceType={tab as ListableResourceType}
              filterState={listFilter}
              onFilterChange={handleFilterChange}
              onEdit={(name) => setEditName(name)}
              onRefresh={() => void refreshScan()}
              showProjectFilter={false}
              hideHeader
            />
          ) : null}
        </div>
      </div>

      {editName && (
        <div className="absolute inset-0 z-10 flex flex-col bg-zinc-950">
          <ResourceEditView
            resourceType={tab}
            resourceName={editName}
            onBack={() => setEditName(null)}
          />
        </div>
      )}
    </div>
  )
}
