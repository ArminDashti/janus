import { useMemo } from 'react'
import type { ResourceGroupSummary, UiFilterState } from '@shared/types'
import { formatDateWithRelative } from '@shared/utils.browser'
import { Trash } from 'lucide-react'
import { ResourceTable } from './ResourceTable'
import { ResourceListToolbar } from './ResourceListToolbar'
import { StructureWarningIcon } from './StructureWarningIcon'
import { useAppStore } from '@renderer/stores/appStore'
import { ALL_PROJECTS_KEY, GLOBAL_KEY } from './ProjectFilterDropdown'

interface HooksListViewProps {
  summaries: ResourceGroupSummary[]
  loading: boolean
  filterState: UiFilterState
  onFilterChange: (patch: Partial<UiFilterState>) => void
  onEdit: (name: string) => void
  onAdd?: () => void
  onRename?: (oldName: string, newName: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
  showProjectFilter?: boolean
  hideHeader?: boolean
}

function buildHookColumns(
  onDelete: (name: string) => void,
  onRename?: (oldName: string, newName: string) => Promise<void>
) {
  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  return [
    {
      key: 'name',
      label: 'Name',
      className: 'min-w-[16rem] w-[22rem]',
      render: (row: ResourceGroupSummary) =>
        onRename ? (
          <div className="flex items-center gap-2 min-w-[14rem]">
            <StructureWarningIcon row={row} />
            <input
              type="text"
              defaultValue={row.name}
              key={`${row.groupKey}-hook-name`}
              onClick={stopProp}
              onBlur={(e) => {
                const next = e.target.value.trim()
                if (next && next !== row.name) void onRename(row.groupKey || row.name, next)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded px-1 py-0.5 text-sm font-medium text-zinc-200"
            />
          </div>
        ) : (
          <span className="font-medium text-zinc-200 inline-flex items-center gap-2">
            <StructureWarningIcon row={row} />
            {row.name}
          </span>
        )
    },
    {
      key: 'event',
      label: 'Event',
      className: 'min-w-[10rem]',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">{row.event ?? '—'}</span>
      )
    },
    {
      key: 'projects',
      label: 'Projects',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">
          {row.usedProjectCount}/{row.totalProjectCount}
        </span>
      )
    },
    {
      key: 'tokens',
      label: 'Tokens',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">{row.tokenEstimate.toLocaleString()}</span>
      )
    },
    {
      key: 'updated',
      label: 'Last updated',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-500">{formatDateWithRelative(row.lastUpdatedAt)}</span>
      )
    },
    {
      key: 'actions',
      label: '',
      className: 'w-14',
      render: (row: ResourceGroupSummary) => (
        <div className="flex items-center gap-0.5 whitespace-nowrap">
          <button
            type="button"
            onClick={(e) => {
              stopProp(e)
              void onDelete(row.groupKey || row.name)
            }}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
            title="Delete"
          >
            <Trash size={15} strokeWidth={1.75} />
          </button>
        </div>
      )
    }
  ]
}

export function HooksListView({
  summaries,
  loading,
  filterState,
  onFilterChange,
  onEdit,
  onAdd,
  onRename,
  onDelete,
  showProjectFilter = true,
  hideHeader = false
}: HooksListViewProps) {
  const { settings } = useAppStore()
  const { search, selectedProjectId, sortKey, sortDir } = filterState

  const projects = useMemo(
    () =>
      settings?.projectRoots
        .flatMap((r) => r.projects)
        .sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [settings]
  )

  const filtered = useMemo(() => {
    let rows = summaries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) =>
        [r.name, r.description, r.event].join(' ').toLowerCase().includes(q)
      )
    }
    if (selectedProjectId !== ALL_PROJECTS_KEY && selectedProjectId !== GLOBAL_KEY) {
      rows = rows.filter((r) => r.assignedProjectIds.includes(selectedProjectId))
    }
    return [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'updated') {
        return (
          ((a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0) -
            (b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0)) *
          dir
        )
      }
      if (sortKey === 'event') {
        return (a.event ?? '').localeCompare(b.event ?? '') * dir
      }
      return a.name.localeCompare(b.name) * dir
    })
  }, [summaries, search, selectedProjectId, sortKey, sortDir])

  const columns = useMemo(() => buildHookColumns(onDelete, onRename), [onDelete, onRename])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      onFilterChange({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      onFilterChange({ sortKey: key, sortDir: 'asc' })
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {!hideHeader && (
        <header className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-lg font-medium">Hooks</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Cursor only</p>
        </header>
      )}
      <ResourceListToolbar
        search={search}
        onSearchChange={(value) => onFilterChange({ search: value })}
        onAdd={onAdd}
        showProjectFilter={showProjectFilter}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectFilterChange={(value) => onFilterChange({ selectedProjectId: value })}
      />
      {loading && summaries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">No hooks found</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <ResourceTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.groupKey || r.name}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(row) => onEdit(row.groupKey || row.name)}
          />
        </div>
      )}
    </div>
  )
}
