import type { ReactNode } from 'react'

interface CollapsibleNavGroupProps {
  label: string
  collapsed?: boolean
  children: ReactNode
}

/** Section label. Groups stay open — the nav matches the fixed Resources / Other layout. */
export function CollapsibleNavGroup({ label, collapsed = false, children }: CollapsibleNavGroupProps) {
  if (collapsed) {
    return <div className="space-y-0.5 pt-2">{children}</div>
  }

  return (
    <div className="pt-4">
      <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
