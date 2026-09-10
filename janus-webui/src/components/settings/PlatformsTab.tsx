import { useEffect, useMemo, useState } from 'react'
import { Folder } from 'lucide-react'
import type { AppSettings, PlatformConfig, PlatformId } from '@shared/types'
import {
  DEFAULT_PLATFORM_PROJECT_DIRS,
  DEFAULT_PLATFORM_ROOTS,
  PLATFORM_IDS,
  PLATFORM_LABELS
} from '@shared/types'
import { PlatformLogo } from '@renderer/components/PlatformLogo'
import { cn } from '@renderer/lib/utils'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

interface PlatformsTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

function ensurePlatforms(settings: AppSettings): PlatformConfig[] {
  const byId = new Map(settings.platforms.map((p) => [p.id, p]))
  return PLATFORM_IDS.map((id) => {
    const existing = byId.get(id)
    return (
      existing ?? {
        id,
        enabled: id === 'cursor',
        rootPath: DEFAULT_PLATFORM_ROOTS[id],
        projectDirName: DEFAULT_PLATFORM_PROJECT_DIRS[id]
      }
    )
  })
}

export function PlatformsTab({ settings, onChange }: PlatformsTabProps) {
  const { loadSettings } = useAppStore()
  const seeded = useMemo(() => ensurePlatforms(settings), [settings])
  const [platforms, setPlatforms] = useState<PlatformConfig[]>(seeded)

  useEffect(() => {
    setPlatforms(ensurePlatforms(settings))
  }, [settings])

  const updatePlatform = (
    id: PlatformId,
    patch: Partial<Pick<PlatformConfig, 'enabled' | 'rootPath' | 'projectDirName'>>
  ) => {
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const savePlatforms = async () => {
    const confirmed = await showMessage({
      message: 'Save platform settings?',
      confirm: true
    })
    if (!confirmed) return

    for (const p of platforms) {
      if (!p.rootPath.trim()) {
        await showMessage({
          message: `${PLATFORM_LABELS[p.id]}: global folder is required`,
          type: 'error'
        })
        return
      }
      if (!p.projectDirName.trim()) {
        await showMessage({
          message: `${PLATFORM_LABELS[p.id]}: project folder name is required`,
          type: 'error'
        })
        return
      }
    }

    const next: AppSettings = {
      ...settings,
      platforms: platforms.map((p) => ({
        ...p,
        rootPath: p.rootPath.trim(),
        projectDirName: p.projectDirName.trim()
      }))
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Platform settings saved', type: 'success' })
  }

  return (
    <div className="space-y-6 pb-6">
      <p className="text-xs text-zinc-500">
        Enable platforms and set each global folder (user home config) and the folder name used
        inside projects.
      </p>

      <div className="space-y-3">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className={cn(
              'flex flex-col gap-3 p-4 rounded-xl border max-w-2xl',
              platform.enabled
                ? 'bg-zinc-900/70 border-zinc-700'
                : 'bg-zinc-950/50 border-zinc-800 opacity-80'
            )}
          >
            <div className="flex items-center gap-3">
              <PlatformLogo platformId={platform.id} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    {PLATFORM_LABELS[platform.id]}
                  </span>
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      platform.enabled ? 'bg-emerald-500' : 'bg-zinc-600'
                    )}
                    title={platform.enabled ? 'Enabled' : 'Disabled'}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
                <input
                  type="checkbox"
                  checked={platform.enabled}
                  onChange={(e) => updatePlatform(platform.id, { enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                Global folder
              </span>
              <div className="flex items-center gap-2">
                <Folder size={14} strokeWidth={1.75} className="text-zinc-500 shrink-0" />
                <input
                  value={platform.rootPath}
                  onChange={(e) => updatePlatform(platform.id, { rootPath: e.target.value })}
                  title={platform.rootPath}
                  placeholder={DEFAULT_PLATFORM_ROOTS[platform.id]}
                  className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-200"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                Project folder name
              </span>
              <input
                value={platform.projectDirName}
                onChange={(e) => updatePlatform(platform.id, { projectDirName: e.target.value })}
                placeholder={DEFAULT_PLATFORM_PROJECT_DIRS[platform.id]}
                className="w-full max-w-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-200"
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void savePlatforms()}
        className="px-4 py-2 text-sm bg-emerald-700 rounded"
      >
        Save platform settings
      </button>
    </div>
  )
}
