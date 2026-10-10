import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { HubSkill, HubSource } from '@renderer/api/types'

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function HubPage() {
  const [sources, setSources] = useState<HubSource[]>([])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [skills, setSkills] = useState<HubSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    window.agentManager
      .hubSources()
      .then((list) => {
        setSources(list)
        setSourceId(list[0]?.id ?? null)
      })
      .catch((e) => setStatus(errorMessage(e)))
  }, [])

  useEffect(() => {
    if (!sourceId) return
    setLoading(true)
    setStatus(null)
    window.agentManager
      .hubSkills(sourceId)
      .then(setSkills)
      .catch((e) => {
        setSkills([])
        setStatus(errorMessage(e))
      })
      .finally(() => setLoading(false))
  }, [sourceId])

  const handleImport = async (skill: HubSkill) => {
    if (!sourceId) return
    setImporting(skill.path)
    setStatus(null)
    try {
      const name = await window.agentManager.importHubSkill(sourceId, skill.path)
      setStatus(`Imported "${name}" into Skills.`)
      window.dispatchEvent(new Event('scan-changed'))
    } catch (e) {
      setStatus(errorMessage(e))
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0 p-6 gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-zinc-200">Hub</h2>
          <p className="text-xs text-zinc-500">Import skills from popular public GitHub sources.</p>
        </div>
        <select
          value={sourceId ?? ''}
          onChange={(e) => setSourceId(e.target.value)}
          aria-label="Hub source"
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 cursor-pointer focus:outline-none focus:border-zinc-500"
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {status && <p className="text-xs text-zinc-400">{status}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-800 rounded-lg divide-y divide-zinc-800">
        {loading ? (
          <p className="p-4 text-xs text-zinc-500 text-center">Loading…</p>
        ) : skills.length === 0 ? (
          <p className="p-4 text-xs text-zinc-500 text-center">No skills found in this source</p>
        ) : (
          skills.map((skill) => (
            <div key={skill.path} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm text-zinc-300 truncate" title={skill.path}>
                {skill.name}
              </span>
              <button
                type="button"
                onClick={() => void handleImport(skill)}
                disabled={importing !== null}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
              >
                <Download size={12} />
                {importing === skill.path ? 'Importing…' : 'Import'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
