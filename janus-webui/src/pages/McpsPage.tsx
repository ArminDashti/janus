import { Fragment, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Loader2, Pencil, Plus, Trash } from 'lucide-react'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { McpToolsModal } from '@renderer/components/mcp/McpToolsModal'
import { ResourceSubViewHeader } from '@renderer/components/resources/ResourceListView'
import { Toggle } from '@renderer/components/Toggle'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'
import type { McpProbeResult, McpResource } from '@shared/types'

type ViewMode = 'list' | 'edit'

function statusBadgeClass(status: McpResource['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-900/50 text-emerald-400'
    case 'configured':
    case 'unknown':
      return 'bg-amber-900/40 text-amber-400'
    case 'error':
    case 'disconnected':
      return 'bg-red-900/40 text-red-400'
    default:
      return 'bg-zinc-800 text-zinc-400'
  }
}

/** Directory containing the MCP config file (mcp.json). */
function configDir(configPath: string): string {
  const normalized = configPath.replace(/[\\/]+$/, '')
  const idx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  return idx > 0 ? normalized.slice(0, idx) : normalized
}

export function McpsPage() {
  const { scan, refreshScan, settings, loadSettings } = useAppStore()
  const [view, setView] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<McpResource | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addJson, setAddJson] = useState('{\n  "command": "npx",\n  "args": ["-y", "some-mcp-server"]\n}')
  const [addName, setAddName] = useState('')
  const [paramsJson, setParamsJson] = useState('')
  const [toolsFor, setToolsFor] = useState<
    Pick<McpResource, 'name' | 'status' | 'tools' | 'error'> | null
  >(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, McpProbeResult>>({})

  useEffect(() => {
    void refreshScan({ probeMcps: true })
  }, [refreshScan])

  const mcps = useMemo(() => {
    const map = new Map<string, McpResource>()
    for (const m of scan?.mcps ?? []) {
      const existing = map.get(m.name)
      if (existing) {
        existing.platforms = [...new Set([...existing.platforms, ...m.platforms])]
      } else {
        map.set(m.name, { ...m, platforms: [...m.platforms] })
      }
    }
    const merged = [...map.values()].map((m) =>
      testResults[m.name] ? { ...m, ...testResults[m.name] } : m
    )
    return merged.sort((a, b) => a.name.localeCompare(b.name))
  }, [scan, testResults])

  const openEdit = (mcp: McpResource) => {
    setSelected(mcp)
    setParamsJson(JSON.stringify(mcp.params, null, 2))
    setView('edit')
  }

  const handleToggleEnabled = async (mcp: McpResource) => {
    if (!settings) return
    const enabled = settings.mcpEnabled?.[mcp.name] ?? mcp.enabled ?? true
    try {
      await window.agentManager.saveSettings({
        ...settings,
        mcpEnabled: { ...(settings.mcpEnabled ?? {}), [mcp.name]: !enabled }
      })
      await loadSettings()
      await refreshScan({ probeMcps: true })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Save failed',
        type: 'error'
      })
    }
  }

  const handleDelete = async (mcp: McpResource) => {
    const confirmed = await showMessage({
      message: `Remove MCP "${mcp.name}" from configuration?`,
      confirm: true,
      type: 'error',
      title: 'Remove MCP'
    })
    if (!confirmed) return
    await window.agentManager.deleteMcp(mcp.name, mcp.configPath)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[mcp.name]
      return next
    })
    await refreshScan({ probeMcps: true })
  }

  const handleTest = async (mcp: McpResource) => {
    setTesting(mcp.name)
    try {
      const result = await window.agentManager.testMcp(mcp.name, mcp.params)
      setTestResults((prev) => ({ ...prev, [mcp.name]: result }))
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [mcp.name]: {
          status: 'error',
          tools: [],
          error: e instanceof Error ? e.message : 'Test failed'
        }
      }))
    } finally {
      setTesting(null)
    }
  }

  const handleAdd = async () => {
    if (!addName.trim()) {
      await showMessage({ message: 'Name is required', type: 'error' })
      return
    }
    try {
      const params = JSON.parse(addJson) as Record<string, unknown>
      await window.agentManager.addMcp(addName.trim(), params)
      setAddOpen(false)
      setAddName('')
      await refreshScan({ probeMcps: true })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Invalid JSON',
        type: 'error'
      })
    }
  }

  const saveParams = async (jsonOverride?: string) => {
    if (!selected) return
    const confirmed = await showMessage({
      message: `Save changes to ${selected.name}?`,
      confirm: true
    })
    if (!confirmed) return
    try {
      const raw = jsonOverride ?? paramsJson
      const toSave = JSON.parse(raw) as Record<string, unknown>
      const config = JSON.parse(await window.agentManager.readFile(selected.configPath))
      config.mcpServers ??= {}
      config.mcpServers[selected.name] = toSave
      await window.agentManager.writeFile(selected.configPath, JSON.stringify(config, null, 2))
      setParamsJson(JSON.stringify(toSave, null, 2))
      await refreshScan({ probeMcps: true })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Invalid JSON',
        type: 'error'
      })
    }
  }

  if (view === 'edit' && selected) {
    const displayed = testResults[selected.name]
      ? { ...selected, ...testResults[selected.name] }
      : selected
    return (
      <div className="flex flex-col h-full">
        <ResourceSubViewHeader
          title={`Edit: ${selected.name}`}
          onBack={() => {
            setView('list')
            setSelected(null)
          }}
        />
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">
          <div className="space-y-1 shrink-0">
            <p className="text-sm text-zinc-500">IDE/CLI: {selected.platforms.join(', ')}</p>
            <p className="text-xs font-mono text-zinc-600 truncate" title={selected.configPath}>
              {selected.configPath}
            </p>
            {displayed.error && (
              <p className="text-xs text-red-400" title={displayed.error}>
                {displayed.error}
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <JsonEditor
              value={paramsJson}
              onChange={setParamsJson}
              onSave={async (v) => {
                setParamsJson(v)
                await saveParams(v)
              }}
            />
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() =>
                setToolsFor({
                  name: displayed.name,
                  status: displayed.status,
                  tools: displayed.tools,
                  error: displayed.error
                })
              }
              className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
            >
              Open tools ({displayed.tools.length})
            </button>
          </div>
        </div>
        {toolsFor && <McpToolsModal mcp={toolsFor} onClose={() => setToolsFor(null)} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">MCPs</h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded"
        >
          <Plus size={14} /> Add MCP
        </button>
      </header>

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-zinc-950 z-10">
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Enabled</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Tools</th>
              <th className="px-4 py-2 font-medium">Directory</th>
              <th className="px-4 py-2 w-32" />
            </tr>
          </thead>
          <tbody>
            {mcps.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No MCP servers configured
                </td>
              </tr>
            ) : (
              mcps.map((row) => {
                const isTesting = testing === row.name
                const enabled = settings?.mcpEnabled?.[row.name] ?? row.enabled ?? true
                return (
                  <Fragment key={row.name}>
                    <tr
                      className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-zinc-200 font-medium">{row.name}</td>
                      <td className="px-4 py-2.5">
                        <Toggle
                          checked={enabled}
                          onChange={() => void handleToggleEnabled(row)}
                          title={enabled ? `Disable ${row.name}` : `Enable ${row.name}`}
                          ariaLabel={`${enabled ? 'Disable' : 'Enable'} ${row.name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-1">
                          {enabled ? (
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded inline-block',
                                statusBadgeClass(row.status)
                              )}
                            >
                              {row.status}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded inline-block bg-zinc-800 text-zinc-400">
                              disabled
                            </span>
                          )}
                          {row.error && (
                            <p
                              className="text-[11px] text-red-400 max-w-[280px] line-clamp-2"
                              title={row.error}
                            >
                              {row.error}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setToolsFor({
                              name: row.name,
                              status: row.status,
                              tools: row.tools,
                              error: row.error
                            })
                          }
                          className="text-zinc-300 hover:text-zinc-100 underline decoration-zinc-700 underline-offset-2"
                          title="Open tools"
                        >
                          {row.tools.length} tool{row.tools.length === 1 ? '' : 's'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="font-mono text-xs text-zinc-500 max-w-[260px] truncate block"
                          title={row.configPath}
                        >
                          {configDir(row.configPath)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-0.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void handleTest(row)}
                            disabled={isTesting}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 disabled:opacity-50"
                            title="Test connection"
                          >
                            {isTesting ? (
                              <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
                            ) : (
                              <FlaskConical size={15} strokeWidth={1.75} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                            title="Edit"
                          >
                            <Pencil size={15} strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {toolsFor && <McpToolsModal mcp={toolsFor} onClose={() => setToolsFor(null)} />}

      {addOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[520px] max-h-[80vh] flex flex-col">
            <h3 className="font-medium mb-4">Add MCP Server</h3>
            <label className="text-sm text-zinc-400 mb-1 block">Server name</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="my-mcp-server"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-3"
            />
            <label className="text-sm text-zinc-400 mb-1 block">Configuration (JSON)</label>
            <textarea
              value={addJson}
              onChange={(e) => setAddJson(e.target.value)}
              rows={10}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm font-mono flex-1 min-h-[200px]"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-sm bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                className="px-4 py-2 text-sm bg-blue-600 rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
