import type { UiFilterState, UiSearchField } from '@shared/types'
import { ALL_PROJECTS_KEY, GLOBAL_KEY } from '@renderer/components/resources/ProjectFilterDropdown'

export type ListableResourceType = 'skill' | 'rule' | 'hook' | 'subAgent'

const FILTER_KEYS: Record<ListableResourceType, string> = {
  skill: 'skills',
  rule: 'rules',
  hook: 'hooks',
  subAgent: 'subagents'
}

export function filterStorageKey(resourceType: ListableResourceType): string {
  return FILTER_KEYS[resourceType]
}

/** Default list filter: show every item (All). */
export function defaultSelectedProjectId(_resourceType?: ListableResourceType): string {
  return ALL_PROJECTS_KEY
}

export const DEFAULT_UI_FILTER: UiFilterState = {
  search: '',
  searchField: 'name',
  selectedProjectId: ALL_PROJECTS_KEY,
  selectedCategories: [],
  sortKey: 'name',
  sortDir: 'asc'
}

type LegacyUiFilter = Partial<UiFilterState> & {
  filter?: 'all' | 'single-project'
  hideSingleProject?: boolean
  projectUsageFilter?: string
}

export function mergeUiFilter(
  partial?: Partial<UiFilterState> | LegacyUiFilter,
  resourceType?: ListableResourceType
): UiFilterState {
  const legacy = (partial ?? {}) as LegacyUiFilter
  const {
    filter: _legacyFilter,
    hideSingleProject: _hideSingle,
    projectUsageFilter: _usage,
    ...rest
  } = legacy

  const defaultProjectId = defaultSelectedProjectId(resourceType)

  // Persisted filters from before searchField existed land here as undefined.
  const searchField: UiSearchField =
    rest.searchField === 'tags' || rest.searchField === 'category'
      ? rest.searchField
      : 'name'

  let selectedProjectId = rest.selectedProjectId ?? defaultProjectId

  // Migrate old Global list filter → All
  if (selectedProjectId === GLOBAL_KEY) {
    selectedProjectId = ALL_PROJECTS_KEY
  }

  return {
    ...DEFAULT_UI_FILTER,
    ...rest,
    searchField,
    selectedProjectId,
    selectedCategories: rest.selectedCategories ?? DEFAULT_UI_FILTER.selectedCategories
  }
}
