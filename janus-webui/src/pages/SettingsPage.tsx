import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { useAppStore } from '@renderer/stores/appStore'
import { GeneralTab } from '@renderer/components/settings/GeneralTab'
import { AppearanceTab } from '@renderer/components/settings/AppearanceTab'
import { PlatformsTab } from '@renderer/components/settings/PlatformsTab'
import { ProjectImportSection } from '@renderer/components/settings/ProjectImportSection'

type SettingsTab = 'general' | 'appearance' | 'platforms' | 'projects'

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'platforms', label: 'IDE/CLI' },
  { id: 'projects', label: 'Projects' }
]

export function SettingsPage() {
  const { settings, loadSettings } = useAppStore()
  const [tab, setTab] = useState<SettingsTab>('general')
  const [localSettings, setLocalSettings] = useState(settings)

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (settings) setLocalSettings(settings)
  }, [settings])

  if (!localSettings) {
    return <div className="p-6 text-zinc-500 text-sm">Loading settings…</div>
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="text-lg font-medium mb-4">Settings</h2>

      <div className="flex border-b border-zinc-800 gap-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm',
              tab === t.id ? 'border-b-2 border-blue-500 text-blue-400' : 'text-zinc-500'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <GeneralTab settings={localSettings} onChange={setLocalSettings} />
      )}
      {tab === 'appearance' && (
        <AppearanceTab settings={localSettings} onChange={setLocalSettings} />
      )}
      {tab === 'platforms' && (
        <PlatformsTab settings={localSettings} onChange={setLocalSettings} />
      )}
      {tab === 'projects' && (
        <div className="space-y-6">
          <ProjectImportSection settings={localSettings} onChange={setLocalSettings} />
        </div>
      )}
    </div>
  )
}
