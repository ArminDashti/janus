import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'

export function TitleBar() {
  const [iconSrc, setIconSrc] = useState<string | null>(null)

  useEffect(() => {
    window.agentManager.getBrandingPath('janus-icon').then((path) => {
      if (path) setIconSrc(path)
    })
  }, [])

  return (
    <header
      className={cn(
        'flex items-center h-9 shrink-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 select-none'
      )}
    >
      <div className="flex items-center gap-2 px-3">
        {iconSrc ? (
          <img src={iconSrc} alt="Janus" className="w-6 h-6 rounded-md object-contain" />
        ) : (
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-cyan-600/20 text-cyan-400 text-xs font-bold">
            J
          </div>
        )}
        <span className="text-sm font-medium text-zinc-200">Janus</span>
        <span className="text-xs text-zinc-500 hidden sm:inline">Skills · Rules · MCPs</span>
      </div>
    </header>
  )
}
