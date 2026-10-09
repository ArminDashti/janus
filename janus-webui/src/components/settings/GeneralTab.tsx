import { useEffect, useState } from 'react'
import { Rocket } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { Toggle } from '@renderer/components/Toggle'
import { SettingsSection } from '@renderer/components/settings/SettingsSection'

interface GeneralTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  const { loadSettings } = useAppStore()
  const [runOnLogin, setRunOnLogin] = useState(settings.startup?.runOnLogin ?? false)

  useEffect(() => {
    setRunOnLogin(settings.startup?.runOnLogin ?? false)
  }, [settings])

  const saveGeneral = async () => {
    const confirmed = await showMessage({
      message: 'Save general settings?',
      confirm: true
    })
    if (!confirmed) return

    const next: AppSettings = {
      ...settings,
      startup: { runOnLogin }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Settings saved', type: 'success' })
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={Rocket}
        title="Startup"
        description="Launch Janus automatically when you sign in to Windows."
      >
        <div className="flex items-center justify-between gap-4 max-w-md rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <span className="text-sm text-zinc-200">Run Janus when Windows starts</span>
          <Toggle
            checked={runOnLogin}
            onChange={setRunOnLogin}
            ariaLabel="Run Janus when Windows starts"
          />
        </div>
      </SettingsSection>

      <div>
        <button
          type="button"
          onClick={() => void saveGeneral()}
          className="px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-600 rounded-lg"
        >
          Save general settings
        </button>
      </div>
    </div>
  )
}
