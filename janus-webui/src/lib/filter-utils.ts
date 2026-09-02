import type { UiFilterState } from '@shared/types'
import { ALL_PROJECTS_KEY, GLOBAL_KEY } from '@renderer/components/resources/ProjectFilterDropdown'

export type ListableResourceType = 'skill' | 'rule' | 'hook' | 'subAgent' | 'tool'

const FILTER_KEYS: Record<ListableResourceType, string> = {
  skill: 'skills',
  rule: 'rules',
  hook: 'hooks',
  subAgent: 'subagents',
  tool: 'tools'
}

export function filterStorageKey(resourceType: ListableResourceType): string {
  return FILTER_KEYS[resourceType]
}

/** Types whose project dropdown uses Global (~/.cursor) instead of All projects. */
export function usesGlobalScope(resourceType: ListableResourceType): boolean {
  return resourceType === 'skill' || resourceType === 'hook' || resourceType === 'subAgent'
}

export function defaultSelectedProjectId(resourceType: ListableResourceType): string {
  return usesGlobalScope(resourceType) ? GLOBAL_KEY : ALL_PROJECTS_KEY
}

export const DEFAULT_UI_FILTER: UiFilterState = {
  search: '',
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

  const defaultProjectId = resourceType
    ? defaultSelectedProjectId(resourceType)
    : DEFAULT_UI_FILTER.selectedProjectId

  let selectedProjectId = rest.selectedProjectId ?? defaultProjectId

  // Migrate old "All projects" sentinel → Global for skills/hooks/sub-agents
  if (resourceType && usesGlobalScope(resourceType) && selectedProjectId === ALL_PROJECTS_KEY) {
    selectedProjectId = GLOBAL_KEY
  }

  return {
    ...DEFAULT_UI_FILTER,
    ...rest,
    selectedProjectId,
    selectedCategories: rest.selectedCategories ?? DEFAULT_UI_FILTER.selectedCategories
  }
}
