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
import { Toggle } from '@renderer/components/Toggle'
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
      message: 'Save IDE/CLI settings?',
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
    await showMessage({ message: 'IDE/CLI settings saved', type: 'success' })
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-start justify-between gap-6">
        <p className="text-xs text-zinc-500 max-w-2xl">
          Enable IDE/CLIs and set each global folder (user home config) and the folder name used
          inside projects.
        </p>
        <button
          type="button"
          onClick={() => void savePlatforms()}
          className="px-4 py-2 text-sm bg-emerald-700 rounded shrink-0"
        >
          Save IDE/CLI settings
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className={cn(
              'flex flex-col rounded-xl border p-4 transition-colors',
              platform.enabled
                ? 'bg-zinc-900/70 border-zinc-700'
                : 'bg-zinc-950/50 border-zinc-800 opacity-75'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 shrink-0">
                <PlatformLogo platformId={platform.id} size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-zinc-100">
                  {PLATFORM_LABELS[platform.id]}
                </span>
                <p
                  className="text-[11px] font-mono text-zinc-500 truncate"
                  title={platform.rootPath}
                >
                  {platform.rootPath || DEFAULT_PLATFORM_ROOTS[platform.id]}
                </p>
              </div>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
                  platform.enabled
                    ? 'bg-emerald-900/50 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500'
                )}
              >
                {platform.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <Toggle
                checked={platform.enabled}
                onChange={(checked) => updatePlatform(platform.id, { enabled: checked })}
                ariaLabel={`${PLATFORM_LABELS[platform.id]} enabled`}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Global folder
                </span>
                <div className="flex items-center gap-2">
                  <Folder size={14} strokeWidth={1.75} className="text-zinc-500 shrink-0" />
                  <input
                    value={platform.rootPath}
                    onChange={(e) => updatePlatform(platform.id, { rootPath: e.target.value })}
                    disabled={!platform.enabled}
                    title={platform.rootPath}
                    placeholder={DEFAULT_PLATFORM_ROOTS[platform.id]}
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 disabled:opacity-50"
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
                  disabled={!platform.enabled}
                  placeholder={DEFAULT_PLATFORM_PROJECT_DIRS[platform.id]}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-200 disabled:opacity-50"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
