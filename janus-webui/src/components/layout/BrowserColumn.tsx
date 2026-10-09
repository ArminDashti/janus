import type { ReactNode } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import type { UiSearchField } from '@shared/types'
import { cn } from '@renderer/lib/utils'

const SEARCH_FIELDS: { value: UiSearchField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'tags', label: 'Tags' },
  { value: 'category', label: 'Category' }
]

interface BrowserColumnProps {
  title: string
  countLabel: string
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  searchDisabled?: boolean
  actions?: ReactNode
  /** Name / Tags / Category plus A–Z toggle. Omitted on columns that are not name lists. */
  nameHeader?: {
    searchField: UiSearchField
    onSearchFieldChange: (field: UiSearchField) => void
    sortDir: 'asc' | 'desc'
    onToggleSort: () => void
  }
  children: ReactNode
}

export function browserRowClass(selected: boolean): string {
  return cn(
    'group mx-1.5 my-px flex items-center rounded-md min-h-8',
    selected ? 'bg-accent text-white' : 'text-zinc-300 hover:bg-zinc-800/80'
  )
}

export function BrowserColumn({
  title,
  countLabel,
  search,
  onSearch,
  searchPlaceholder,
  searchDisabled,
  actions,
  nameHeader,
  children
}: BrowserColumnProps) {
  return (
    <aside className="w-full h-full flex flex-col bg-surface">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        <span className="text-[11px] leading-none px-1.5 py-1 rounded-md bg-zinc-800 text-zinc-400 tabular-nums">
          {countLabel}
        </span>
        {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            disabled={searchDisabled}
            className="w-full bg-surface-input border border-surface-border rounded-md pl-8 pr-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent disabled:opacity-50"
          />
        </div>
      </div>
      {nameHeader && (
        <div className="flex items-center justify-between px-3 py-1 text-[11px] text-zinc-500">
          <select
            value={nameHeader.searchField}
            onChange={(e) => nameHeader.onSearchFieldChange(e.target.value as UiSearchField)}
            aria-label="Search field"
            title="Search in"
            className="bg-transparent text-[11px] text-zinc-400 cursor-pointer focus:outline-none"
          >
            {SEARCH_FIELDS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={nameHeader.onToggleSort}
            className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-200"
            title={nameHeader.sortDir === 'asc' ? 'Sort Z–A' : 'Sort A–Z'}
          >
            <ArrowUpDown size={12} />
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto pb-2">{children}</div>
    </aside>
  )
}
