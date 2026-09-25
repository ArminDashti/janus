import { ProjectFilterDropdown } from './ProjectFilterDropdown'
import type { ProjectInfo, UiSearchField } from '@shared/types'

const SEARCH_FIELD_OPTIONS: { value: UiSearchField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'tags', label: 'Tags' },
  { value: 'category', label: 'Category' }
]

interface ResourceListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchField?: UiSearchField
  onSearchFieldChange?: (field: UiSearchField) => void
  onAdd?: () => void
  addLabel?: string
  onApplyAll?: () => void
  applyAllLabel?: string
  projects?: ProjectInfo[]
  selectedProjectId?: string
  onProjectFilterChange?: (projectId: string) => void
  showProjectFilter?: boolean
}

export function ResourceListToolbar({
  search,
  onSearchChange,
  searchField = 'name',
  onSearchFieldChange,
  onAdd,
  addLabel = 'Add',
  onApplyAll,
  applyAllLabel = 'Apply all to projects',
  projects = [],
  selectedProjectId,
  onProjectFilterChange,
  showProjectFilter = false
}: ResourceListToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 flex-nowrap overflow-visible">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search…"
        className="w-72 min-w-[18rem] shrink-0 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
      />
      {onSearchFieldChange && (
        <select
          value={searchField}
          onChange={(e) => onSearchFieldChange(e.target.value as UiSearchField)}
          aria-label="Search field"
          title="Search in"
          className="shrink-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-800"
        >
          {SEARCH_FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {showProjectFilter && onProjectFilterChange && selectedProjectId && (
        <ProjectFilterDropdown
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={onProjectFilterChange}
        />
      )}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {onApplyAll && (
          <button
            type="button"
            onClick={onApplyAll}
            className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded whitespace-nowrap"
          >
            {applyAllLabel}
          </button>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded whitespace-nowrap"
          >
            {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}
