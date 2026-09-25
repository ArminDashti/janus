import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { PLATFORM_LABELS, type PlatformId } from '@shared/types'

interface PlatformLogoProps {
  platformId: PlatformId | string
  size?: number
  className?: string
}

export function PlatformLogo({ platformId, size = 24, className }: PlatformLogoProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [triedPng, setTriedPng] = useState(false)

  useEffect(() => {
    setTriedPng(false)
    window.agentManager.getLogoPath(platformId).then((path) => {
      if (path) setSrc(path)
    })
  }, [platformId])

  const label = PLATFORM_LABELS[platformId as PlatformId] ?? platformId

  // .svg missing => try the .png sibling once, then fall back to initials.
  const handleImgError = () => {
    if (src?.endsWith('.svg') && !triedPng) {
      setTriedPng(true)
      setSrc(`${src.slice(0, -4)}.png`)
    } else {
      setSrc(null)
    }
  }

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        onError={handleImgError}
        className={cn('rounded object-contain', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200',
        className
      )}
      style={{ width: size, height: size }}
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}
