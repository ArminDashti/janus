import { TriangleAlert } from 'lucide-react'
import type { ResourceGroupSummary } from '@shared/types'

interface StructureWarningIconProps {
  row: ResourceGroupSummary
  className?: string
}

export function StructureWarningIcon({ row, className }: StructureWarningIconProps) {
  if (row.structureOk !== false) return null
  return (
    <span
      className={className ?? 'shrink-0 inline-flex text-amber-400'}
      title={row.structureWarning || 'Does not follow the required metadata structure'}
      aria-label={row.structureWarning || 'Structure warning'}
    >
      <TriangleAlert size={14} strokeWidth={2} />
    </span>
  )
}
