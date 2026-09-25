import { X } from 'lucide-react'
import type { McpResource } from '@shared/types'

interface McpToolsModalProps {
  mcp: Pick<McpResource, 'name' | 'status' | 'tools' | 'error'>
  onClose: () => void
}

/** Modal listing the tools an MCP server exposes (item 9 — no inline expansion). */
export function McpToolsModal({ mcp, onClose }: McpToolsModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[560px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-zinc-100">{mcp.name} — tools</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          {mcp.tools.length} tool{mcp.tools.length === 1 ? '' : 's'} · status: {mcp.status}
          {mcp.error ? ` — ${mcp.error}` : ''}
        </p>

        {mcp.tools.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">
            No tools discovered. Run a test to probe this server for tools.
          </p>
        ) : (
          <ul className="space-y-2 overflow-auto min-h-0">
            {mcp.tools.map((tool) => (
              <li
                key={tool.name}
                className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2"
              >
                <div className="text-sm font-medium text-zinc-200">{tool.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {tool.description?.trim() || '—'}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
