import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { ProjectMatrixRow, ResourceGroupSummary } from '@shared/types'
import { ThreePanelLayout } from '@renderer/components/layout/ThreePanelLayout'
import { ResourceEditView } from '@renderer/components/resources/ResourceEditView'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'

function resourceKey(row: ResourceGroupSummary): string {
  return row.groupKey || row.name
}

export function SkillsPage() {
  const [summaries, setSummaries] = useState<ResourceGroupSummary[]>([])
  const [search, setSearch] = useState('')
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null)
  const [projectRows, setProjectRows] = useState<ProjectMatrixRow[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats('skill')
      setSummaries(stats)
      setSelectedSkillKey((current) => {
        if (current && stats.some((row) => resourceKey(row) === current)) return current
        return stats[0] ? resourceKey(stats[0]) : null
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSkills()
    const handler = () => void loadSkills()
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [loadSkills])

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return summaries
    return summaries.filter((row) => {
      const haystack = [row.name, row.description].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [search, summaries])

  useEffect(() => {
    if (!selectedSkillKey) {
      setProjectRows([])
      setSelectedProjectIds(new Set())
      return
    }

    let active = true
    const loadProjectAssignments = async () => {
      try {
        const rows = await window.agentManager.getProjectMatrix('skill', selectedSkillKey)
        if (!active) return
        setProjectRows(rows)
        setSelectedProjectIds(new Set(rows.filter((row) => row.assigned).map((row) => row.projectId)))
      } catch (error) {
        if (!active) return
        await showMessage({
          message: error instanceof Error ? error.message : 'Unable to load project assignments',
          type: 'error'
        })
      }
    }

    void loadProjectAssignments()
    return () => {
      active = false
    }
  }, [selectedSkillKey])

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const handleSaveAssignments = async () => {
    if (!selectedSkillKey) return

    try {
      setSaving(true)
      await window.agentManager.applyProjectAssignment('skill', selectedSkillKey, [...selectedProjectIds])
      await loadSkills()
    } catch (error) {
      await showMessage({
        message: error instanceof Error ? error.message : 'Unable to save skill assignments',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-base font-medium text-zinc-100">Skills</h2>
      </header>

      <div className="border-b border-zinc-800 px-3 py-2">
        <label className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-300">
          <Search size={14} className="text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search skills"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading…</div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
            No matching skills
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSkills.map((row) => {
              const key = resourceKey(row)
              const active = selectedSkillKey === key

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSkillKey(key)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-transparent bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                  )}
                >
                  <div className="font-medium">{row.name}</div>
                  {row.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-400">{row.description}</div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const selectedSkill = summaries.find((row) => resourceKey(row) === selectedSkillKey)

  const middlePanel = selectedSkillKey ? (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-base font-medium text-zinc-100">Projects</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {selectedSkill ? selectedSkill.name : 'Skill'} assignments
        </p>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {projectRows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No projects configured.
          </div>
        ) : (
          <div className="space-y-2">
            {projectRows.map((row) => (
              <label
                key={row.projectId}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700"
              >
                <span className="truncate">{row.projectName}</span>
                <input
                  type="checkbox"
                  checked={selectedProjectIds.has(row.projectId)}
                  onChange={() => toggleProject(row.projectId)}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 p-3">
        <button
          type="button"
          onClick={() => void handleSaveAssignments()}
          disabled={saving || projectRows.length === 0}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {saving ? 'Saving…' : 'Apply assignments'}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      Select a skill
    </div>
  )

  const rightPanel = selectedSkillKey ? (
    <ResourceEditView
      resourceType="skill"
      resourceName={selectedSkillKey}
      onBack={() => setSelectedSkillKey(null)}
    />
  ) : (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      Pick a skill to inspect its content
    </div>
  )

  return (
    <ThreePanelLayout
      autoSaveId="skills-three-panel-layout"
      defaultLeftSize={28}
      defaultMiddleSize={30}
      minLeftSize={24}
      minMiddleSize={24}
      maxLeftSize={40}
      maxMiddleSize={42}
      left={leftPanel}
      middle={middlePanel}
      right={rightPanel}
    />
  )
}
