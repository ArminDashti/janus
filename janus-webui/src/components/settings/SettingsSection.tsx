import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface SettingsSectionProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  aside?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

/** Card group used across Settings: icon badge + title/description header, then content. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  aside,
  className,
  contentClassName,
  children
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="shrink-0 h-10 w-10 rounded-lg bg-blue-600/15 text-blue-400 flex items-center justify-center">
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  )
}
