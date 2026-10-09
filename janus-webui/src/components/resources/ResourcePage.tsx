import { useCallback, useEffect, useRef, useState } from 'react'
import type { UiFilterState } from '@shared/types'
import { ResourceListView } from './ResourceListView'
import { ResourceEditView } from './ResourceEditView'
import { AddResourceModal, isCreatableResourceType } from './AddResourceModal'
import { useAppStore } from '@renderer/stores/appStore'
import {
  filterStorageKey,
  mergeUiFilter,
  type ListableResourceType
} from '@renderer/lib/filter-utils'

type ViewMode = 'list' | 'edit'

interface ResourcePageProps {
  title: string
  subtitle?: string
  resourceType: ListableResourceType
  showAdd?: boolean
}

export function ResourcePage({ title, subtitle, resourceType, showAdd = false }: ResourcePageProps) {
  const { refreshScan, settings } = useAppStore()
  const [view, setView] = useState<ViewMode>('list')
  const [activeName, setActiveName] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const storageKey = filterStorageKey(resourceType)
  const [filterState, setFilterState] = useState<UiFilterState>(() =>
    mergeUiFilter(settings?.uiFilters?.[storageKey], resourceType)
  )

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (settings?.uiFilters?.[storageKey]) {
      setFilterState(mergeUiFilter(settings.uiFilters[storageKey], resourceType))
    } else {
      setFilterState(mergeUiFilter(undefined, resourceType))
    }
  }, [settings, storageKey, resourceType])

  const persistFilters = useCallback(
    (next: UiFilterState) => {
      if (!settings) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void window.agentManager.saveSettings({
          ...settings,
          uiFilters: {
            ...settings.uiFilters,
            [storageKey]: next
          }
        })
      }, 300)
    },
    [settings, storageKey]
  )

  const handleFilterChange = useCallback(
    (patch: Partial<UiFilterState>) => {
      setFilterState((prev) => {
        const next = { ...prev, ...patch }
        persistFilters(next)
        return next
      })
    },
    [persistFilters]
  )

  const backToList = () => {
    setView('list')
    setActiveName(null)
  }

  const listProps = {
    filterState,
    onFilterChange: handleFilterChange,
    onEdit: (name: string) => {
      setActiveName(name)
      setView('edit')
    },
    onRefresh: () => void refreshScan(),
    onAdd: showAdd && isCreatableResourceType(resourceType) ? () => setAddOpen(true) : undefined
  }

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <ResourceListView
          title={title}
          subtitle={subtitle}
          resourceType={resourceType}
          {...listProps}
        />
      </div>
      {view === 'edit' && activeName && (
        <div className="absolute inset-0 z-10 flex flex-col bg-zinc-950">
          <ResourceEditView
            resourceType={resourceType}
            resourceName={activeName}
            onBack={backToList}
          />
        </div>
      )}
      {addOpen && isCreatableResourceType(resourceType) && (
        <AddResourceModal
          resourceType={resourceType}
          onClose={() => setAddOpen(false)}
          onCreated={(name) => {
            void refreshScan()
            if (resourceType === 'skill' && name) {
              setActiveName(name)
              setView('edit')
            }
          }}
        />
      )}
    </div>
  )
}
