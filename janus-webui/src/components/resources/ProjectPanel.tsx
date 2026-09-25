import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderGit2, RefreshCw, Search } from 'lucide-react'
import type { ProjectMatrixRow, ResourceType } from '@shared/types'
import { Toggle } from '@renderer/components/Toggle'
import { cn } from '@renderer/lib/utils'
import { showMessage } from '@renderer/stores/messageStore'

type AssignableResourceType = Extract<ResourceType, 'skill' | 'rule'>

interface ProjectPanelProps {
  resourceType: AssignableResourceType
  /** groupKey/name of the selected resource; null shows the placeholder state. */
  resourceName: string | null
  /** Human label used in the empty-state copy ("skill" / "rule"). */
  resourceLabel: string
  onRefresh?: () => void
}

/**
 * Middle panel: per-project assignment toggles for one resource.
 * Instant save — each toggle calls applyProjectAssignment + setMandatory.
 */
export function ProjectPanel({
  resourceType,
  resourceName,
  resourceLabel,
  onRefresh
}: ProjectPanelProps) {
  const [rows, setRows] = useState<ProjectMatrixRow[]>([])
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [projectSearch, setProjectSearch] = useState('')

  const load = useCallback(
    async (name: string) => {
      setLoading(true)
      setPending({})
      try {
        const matrix = await window.agentManager.getProjectMatrix(resourceType, name)
        setRows(matrix)
      } finally {
        setLoading(false)
      }
    },
    [resourceType]
  )

  useEffect(() => {
    if (resourceName) void load(resourceName)
    else {
      setRows([])
      setPending({})
    }
  }, [resourceName, load])

  useEffect(() => {
    setProjectSearch('')
  }, [resourceName])

  const effectiveAssigned = useMemo(() => {
    const base: Record<string, boolean> = {}
    for (const r of rows) base[r.projectId] = r.assigned
    for (const [id, val] of Object.entries(pending)) base[id] = val
    return base
  }, [rows, pending])

  const assignedCount = useMemo(
    () => Object.values(effectiveAssigned).filter(Boolean).length,
    [effectiveAssigned]
  )

  const toggle = async (projectId: string) => {
    if (!resourceName) return
    const row = rows.find((r) => r.projectId === projectId)
    if (!row) return
    const next = !effectiveAssigned[projectId]

    if (row.platformId) {
      // IDE/CLI global row: copy the resource into (or remove it from) the global folder.
      setPending((p) => ({ ...p, [projectId]: next }))
      setSaving(projectId)
      try {
        await window.agentManager.setGlobalAssignment(
          resourceType,
          resourceName,
          row.platformId,
          next
        )
        onRefresh?.()
        setRows((prev) => prev.map((r) => (r.projectId === projectId ? { ...r, assigned: next } : r)))
        setPending((p) => {
          const n = { ...p }
          delete n[projectId]
          return n
        })
      } catch (e) {
        setPending((p) => {
          const n = { ...p }
          delete n[projectId]
          return n
        })
        await showMessage({
          message: e instanceof Error ? e.message : 'Save failed',
          type: 'error'
        })
      } finally {
        setSaving(null)
      }
      return
    }

    // Prevent removing all project assignments (global rows don't count here).
    const projectRows = rows.filter((r) => !r.platformId)
    const nextAssigned: Record<string, boolean> = {}
    for (const r of projectRows) nextAssigned[r.projectId] = effectiveAssigned[r.projectId] ?? false
    nextAssigned[projectId] = next
    if (!Object.values(nextAssigned).some(Boolean)) {
      await showMessage({ message: 'At least one project must be assigned.', type: 'error' })
      return
    }

    setPending((p) => ({ ...p, [projectId]: next }))
    setSaving(projectId)
    try {
      const assignedIds = Object.entries(nextAssigned)
        .filter(([, v]) => v)
        .map(([k]) => k)
      await window.agentManager.applyProjectAssignment(resourceType, resourceName, assignedIds)
      const mandatory = projectRows.length > 0 && projectRows.every((r) => nextAssigned[r.projectId])
      await window.agentManager.setMandatory(resourceType, resourceName, mandatory)
      onRefresh?.()
      // Sync rows so future toggles have correct base
      setRows((prev) =>
        prev.map((r) => (r.projectId === projectId ? { ...r, assigned: next } : r))
      )
      setPending((p) => {
        const n = { ...p }
        delete n[projectId]
        return n
      })
    } catch (e) {
      // Revert optimistic update
      setPending((p) => {
        const n = { ...p }
        delete n[projectId]
        return n
      })
      await showMessage({
        message: e instanceof Error ? e.message : 'Save failed',
        type: 'error'
      })
    } finally {
      setSaving(null)
    }
  }

  const visibleRows = useMemo(() => {
    const q = projectSearch.trim().toLowerCase()
    // IDE/CLI (Global) rows first, then projects A–Z.
    const sorted = [...rows].sort((a, b) => {
      const aGlobal = a.platformId ? 0 : 1
      const bGlobal = b.platformId ? 0 : 1
      if (aGlobal !== bGlobal) return aGlobal - bGlobal
      return a.projectName.localeCompare(b.projectName)
    })
    if (!q) return sorted
    return sorted.filter((r) => r.projectName.toLowerCase().includes(q))
  }, [rows, projectSearch])

  return (
    <aside className="w-full h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800">
        <h2 className="text-xs font-medium text-zinc-400">
          Projects · {assignedCount}/{rows.length}
        </h2>
        <div className="relative mt-2">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Filter projects…"
            disabled={!resourceName}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 pl-6 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {!resourceName ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <FolderGit2 size={20} className="text-zinc-600" />
            <p className="text-xs text-zinc-500">
              Select a {resourceLabel} to manage project assignments
            </p>
          </div>
        ) : loading ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">Loading projects…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">
            No projects configured. Add project roots in Settings → Projects.
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-500 text-center">No projects match filter</p>
        ) : (
          visibleRows.map((row) => {
            const assigned = effectiveAssigned[row.projectId] ?? false
            const isSaving = saving === row.projectId
            return (
              <div
                key={row.projectId}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 mx-1 rounded-md transition-colors',
                  assigned ? 'bg-zinc-900' : 'hover:bg-zinc-800/60'
                )}
                title={row.projectName}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      assigned ? 'bg-emerald-500' : 'bg-zinc-600'
                    )}
                  />
                  <span className="text-xs text-zinc-200 truncate">{row.projectName}</span>
                </span>
                {isSaving ? (
                  <RefreshCw size={14} className="animate-spin text-zinc-500 shrink-0" />
                ) : (
                  <Toggle
                    checked={assigned}
                    onChange={() => void toggle(row.projectId)}
                    title={
                      assigned
                        ? `Unassign from ${row.projectName}`
                        : `Assign to ${row.projectName}`
                    }
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
