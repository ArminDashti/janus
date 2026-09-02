import { CategoryFilterDropdown } from './CategoryFilterDropdown'
import {
  ProjectFilterDropdown,
  type ProjectFilterScopeMode
} from './ProjectFilterDropdown'
import type { ProjectInfo } from '@shared/types'

interface ResourceListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onAdd?: () => void
  addLabel?: string
  onApplyAll?: () => void
  applyAllLabel?: string
  selectedCategories?: Set<string>
  onCategoryFilterChange?: (selected: Set<string>) => void
  categories?: string[]
  projects?: ProjectInfo[]
  selectedProjectId?: string
  onProjectFilterChange?: (projectId: string) => void
  showProjectFilter?: boolean
  projectFilterScopeMode?: ProjectFilterScopeMode
}

export function ResourceListToolbar({
  search,
  onSearchChange,
  onAdd,
  addLabel = 'Add',
  onApplyAll,
  applyAllLabel = 'Apply all to projects',
  selectedCategories,
  onCategoryFilterChange,
  categories = [],
  projects = [],
  selectedProjectId,
  onProjectFilterChange,
  showProjectFilter = false,
  projectFilterScopeMode = 'allProjects'
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
      {showProjectFilter && onProjectFilterChange && selectedProjectId && (
        <ProjectFilterDropdown
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={onProjectFilterChange}
          scopeMode={projectFilterScopeMode}
        />
      )}
      {onCategoryFilterChange && selectedCategories && (
        <CategoryFilterDropdown
          categories={categories}
          selected={selectedCategories}
          onChange={onCategoryFilterChange}
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
