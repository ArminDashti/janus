import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Layers } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface TreeNode {
  label: string
  path: string
  children: TreeNode[]
  count: number
}

// Each TreeNode keeps a mutable childMap for building; we strip it before render.
interface BuildNode extends TreeNode {
  childMap: Record<string, BuildNode>
}

function buildTree(names: string[]): TreeNode[] {
  const rootMap: Record<string, BuildNode> = {}

  for (const name of names) {
    const parts = name.split('/')
    if (parts.length < 2) continue
    const dirs = parts.slice(0, -1)
    let currentMap = rootMap
    let pathAccum = ''
    for (const part of dirs) {
      pathAccum = pathAccum ? `${pathAccum}/${part}` : part
      if (!currentMap[part]) {
        currentMap[part] = { label: part, path: pathAccum, children: [], count: 0, childMap: {} }
      }
      currentMap[part].count++
      currentMap = currentMap[part].childMap
    }
  }

  function toNodes(map: Record<string, BuildNode>): TreeNode[] {
    return Object.values(map)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ childMap, ...rest }) => ({ ...rest, children: toNodes(childMap) }))
  }

  return toNodes(rootMap)
}

interface TreeNodeItemProps {
  node: TreeNode
  selectedPath: string | null
  onSelect: (path: string | null) => void
  depth: number
}

function TreeNodeItem({ node, selectedPath, onSelect, depth }: TreeNodeItemProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selectedPath === node.path

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-md transition-colors',
          isSelected
            ? 'bg-blue-600/15 text-blue-300'
            : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
        )}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            className="shrink-0 p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50"
            aria-label={open ? 'Collapse folder' : 'Expand folder'}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-[21px] shrink-0" />
        )}
        <button
          type="button"
          title={node.path}
          onClick={() => onSelect(isSelected ? null : node.path)}
          className="flex-1 min-w-0 flex items-center gap-2 py-1.5 pr-2 text-left text-sm"
        >
          {open || !hasChildren ? (
            <FolderOpen
              size={14}
              className={cn('shrink-0', isSelected ? 'text-blue-400' : 'text-zinc-500')}
            />
          ) : (
            <Folder size={14} className="shrink-0 text-zinc-500" />
          )}
          <span className="truncate flex-1 font-medium tracking-tight">{node.label}</span>
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none',
              isSelected
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-400'
            )}
          >
            {node.count}
          </span>
        </button>
      </div>
      {hasChildren && open && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-1 w-px bg-zinc-800/80"
            style={{ left: `${14 + depth * 14}px` }}
            aria-hidden
          />
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ResourceDirTreeProps {
  names: string[]
  selectedPath: string | null
  onSelect: (path: string | null) => void
}

export function ResourceDirTree({ names, selectedPath, onSelect }: ResourceDirTreeProps) {
  const tree = useMemo(() => buildTree(names), [names])
  const totalNested = useMemo(
    () => names.filter((n) => n.includes('/')).length,
    [names]
  )

  if (tree.length === 0) return null

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950/50">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-800">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Folders</span>
        <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500">
          {tree.length}
        </span>
      </div>
      <nav className="flex-1 overflow-auto py-2 px-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'w-full flex items-center gap-2 text-left text-sm py-1.5 px-2 mb-1 rounded-md transition-colors',
            selectedPath === null
              ? 'bg-blue-600/15 text-blue-300'
              : 'text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-200'
          )}
        >
          <Layers
            size={14}
            className={cn('shrink-0', selectedPath === null ? 'text-blue-400' : 'text-zinc-500')}
          />
          <span className="flex-1 font-medium tracking-tight">All folders</span>
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none',
              selectedPath === null
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-zinc-800 text-zinc-500'
            )}
          >
            {totalNested}
          </span>
        </button>
        <div className="space-y-0.5">
          {tree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={0}
            />
          ))}
        </div>
      </nav>
    </aside>
  )
}
