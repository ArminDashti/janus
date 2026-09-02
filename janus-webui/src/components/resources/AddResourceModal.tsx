import { useEffect, useMemo, useState } from 'react'
import type { ResourceType } from '@shared/types'
import { GLOBAL_TARGET_KEY } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

type CreatableResourceType = 'skill' | 'rule' | 'hook' | 'subAgent'

interface AddResourceModalProps {
  resourceType: CreatableResourceType
  onClose: () => void
  onCreated: (name?: string) => void
}

const TYPE_LABELS: Record<CreatableResourceType, string> = {
  skill: 'Skill',
  rule: 'Rule',
  hook: 'Hook',
  subAgent: 'Sub-agent'
}

export function AddResourceModal({ resourceType, onClose, onCreated }: AddResourceModalProps) {
  const { settings, loadSettings, refreshScan } = useAppStore()
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const isSkill = resourceType === 'skill'
  const supportsGlobal = resourceType !== 'rule'

  const projects = useMemo(
    () => settings?.projectRoots.flatMap((r) => r.projects) ?? [],
    [settings]
  )

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (supportsGlobal) {
      setSelectedIds(new Set([GLOBAL_TARGET_KEY]))
    } else if (projects.length > 0) {
      setSelectedIds(new Set(projects.map((p) => p.id)))
    }
  }, [projects, supportsGlobal])

  const toggleTarget = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size <= 1) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const projectIdsSelected = [...selectedIds].filter((id) => id !== GLOBAL_TARGET_KEY)
  const allProjectsSelected =
    projects.length > 0 && projectIdsSelected.length === projects.length

  const toggleSelectAllProjects = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allProjectsSelected) {
        for (const p of projects) next.delete(p.id)
        if (next.size === 0 && supportsGlobal) next.add(GLOBAL_TARGET_KEY)
        if (next.size === 0 && !supportsGlobal && projects[0]) next.add(projects[0].id)
      } else {
        for (const p of projects) next.add(p.id)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      await showMessage({ message: 'Name is required', type: 'error' })
      return
    }
    if (selectedIds.size === 0) {
      await showMessage({
        message: supportsGlobal
          ? 'Select Global and/or at least one project'
          : 'Select at least one project',
        type: 'error'
      })
      return
    }
    setSaving(true)
    const createdName = name.trim()
    try {
      await window.agentManager.createResource(resourceType, createdName, [...selectedIds])
      await refreshScan()
      onCreated(isSkill ? createdName : undefined)
      if (!isSkill) {
        const parts: string[] = []
        if (selectedIds.has(GLOBAL_TARGET_KEY)) parts.push('Global')
        if (projectIdsSelected.length > 0) parts.push('selected projects')
        await showMessage({
          message: `${TYPE_LABELS[resourceType]} "${createdName}" created in ${parts.join(' and ')}`,
          type: 'success'
        })
      }
      onClose()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Create failed',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className={`bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-h-[85vh] flex flex-col ${
          isSkill ? 'w-[720px]' : 'w-[480px]'
        }`}
      >
        <h3 className="font-medium mb-4">Add {TYPE_LABELS[resourceType]}</h3>

        <label className="text-sm text-zinc-400 mb-1 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`my-${resourceType}`}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-4"
        />

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-zinc-400">
            {supportsGlobal ? 'Targets' : 'Target projects'}
          </label>
          {projects.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllProjects}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {allProjectsSelected ? 'Deselect all projects' : 'Select all projects'}
            </button>
          )}
        </div>
        <div
          className={`flex-1 overflow-auto border border-zinc-800 rounded mb-4 ${
            isSkill ? 'min-h-64 max-h-72' : 'max-h-48'
          }`}
        >
          {supportsGlobal && (
            <label className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.has(GLOBAL_TARGET_KEY)}
                onChange={() => toggleTarget(GLOBAL_TARGET_KEY)}
              />
              <span className="text-zinc-200">Global</span>
              <span className="text-zinc-500 text-xs truncate">~/.cursor</span>
            </label>
          )}
          {projects.length === 0 && !supportsGlobal ? (
            <p className="p-3 text-sm text-zinc-500">
              No projects configured. Import projects in Settings.
            </p>
          ) : (
            projects.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 last:border-0 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleTarget(p.id)}
                />
                <span className="text-zinc-200">{p.name}</span>
                <span className="text-zinc-500 text-xs truncate">{p.path}</span>
              </label>
            ))
          )}
        </div>

        <p className="text-xs text-zinc-500 mb-4">
          {supportsGlobal
            ? 'Creates in Global (~/.cursor) and/or each selected project’s .cursor folder.'
            : 'Creates in each selected project’s .cursor folder. At least one project is required.'}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-zinc-800 rounded">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 rounded disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function isCreatableResourceType(type: ResourceType): type is CreatableResourceType {
  return type === 'skill' || type === 'rule' || type === 'hook' || type === 'subAgent'
}
