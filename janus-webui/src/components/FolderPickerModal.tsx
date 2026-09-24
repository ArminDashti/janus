import { useCallback, useEffect, useState } from 'react'
import { ArrowUp, ChevronRight, Folder, Home, Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface FolderPickerModalProps {
  open: boolean
  title?: string
  /** Start directory; empty string starts at the user home directory. */
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

interface DirEntry {
  path: string
  name: string
  isDirectory: boolean
}

function parentPath(path: string): string | null {
  const stripped = path.replace(/[\\/]+$/, '')
  const sep = stripped.includes('\\') ? '\\' : '/'
  const idx = stripped.lastIndexOf(sep)
  if (idx < 0) return null
  const parent = stripped.slice(0, idx)
  // "C:" must become "C:\" — a bare drive letter is the drive's CWD, not its root
  if (/^[a-zA-Z]:$/.test(parent)) return parent + '\\'
  return parent || null
}

function splitPath(path: string): Array<{ label: string; path: string }> {
  if (!path) return []
  const sep = path.includes('\\') ? '\\' : '/'
  const drive = path.match(/^([a-zA-Z]:)[\\/]/)
  const root = drive ? drive[1] + sep : path.startsWith(sep) ? sep : ''
  const rest = root ? path.slice(root.length) : path
  const parts = rest.split(/[\\/]+/).filter(Boolean)
  const segments: Array<{ label: string; path: string }> = [
    { label: root || path, path: root || path }
  ]
  let acc = root
  for (const part of parts) {
    acc = acc && !acc.endsWith(sep) ? acc + sep + part : acc + part
    segments.push({ label: part, path: acc })
  }
  return segments
}

export function FolderPickerModal({
  open,
  title = 'Browse for folder',
  initialPath = '',
  onSelect,
  onClose
}: FolderPickerModalProps) {
  const [path, setPath] = useState(initialPath)
  const [pathInput, setPathInput] = useState(initialPath)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useCallback(async (target: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = (await window.agentManager.listEntries(target)) as DirEntry[]
      const dirs = result.filter((e) => e.isDirectory)
      // Empty start path asks the API for the home directory; recover the real
      // path from the entries it returned so breadcrumbs and Up work.
      let resolved = target
      if (!target && dirs.length > 0) {
        resolved = parentPath(dirs[0].path) ?? dirs[0].path
      }
      setPath(resolved)
      setPathInput(resolved)
      setEntries(dirs)
      if (!target && dirs.length === 0) {
        setError('Could not determine a starting directory.')
      }
    } catch (e) {
      setEntries([])
      setError(e instanceof Error ? e.message : 'Failed to read directory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void navigate(initialPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const up = parentPath(path)
  const segments = splitPath(path)

  const submitPathInput = () => {
    const trimmed = pathInput.trim()
    if (trimmed) void navigate(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-[600px] max-h-[80vh] flex flex-col">
        <h3 className="font-medium mb-4">{title}</h3>

        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => void navigate('')}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
            title="Home"
          >
            <Home size={15} />
          </button>
          <button
            type="button"
            onClick={() => up && void navigate(up)}
            disabled={!up}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Up one level"
          >
            <ArrowUp size={15} />
          </button>
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitPathInput()
            }}
            placeholder="Type a path and press Enter"
            className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-200"
          />
        </div>

        <div className="flex items-center gap-0.5 text-xs text-zinc-500 mb-2 overflow-x-auto shrink-0">
          {segments.map((seg, i) => (
            <span key={seg.path} className="flex items-center gap-0.5 whitespace-nowrap">
              {i > 0 && <ChevronRight size={11} className="shrink-0" />}
              <button
                type="button"
                onClick={() => void navigate(seg.path)}
                className="hover:text-zinc-200 max-w-[160px] truncate"
              >
                {seg.label}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 min-h-[220px] overflow-auto border border-zinc-800 rounded p-1">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : error ? (
            <p className="p-3 text-sm text-red-400">{error}</p>
          ) : entries.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">No subfolders in this directory.</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => void navigate(entry.path)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-sm text-zinc-300 hover:bg-zinc-800"
                title={entry.path}
              >
                <Folder size={14} className="text-zinc-500 shrink-0" />
                <span className="truncate">{entry.name}</span>
              </button>
            ))
          )}
        </div>

        <p className="text-[11px] font-mono text-zinc-500 mt-2 truncate" title={path}>
          {path || '—'}
        </p>

        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-zinc-800 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => path && onSelect(path)}
            disabled={!path || loading || Boolean(error)}
            className="px-4 py-2 text-sm bg-blue-600 rounded disabled:opacity-50"
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>
  )
}
