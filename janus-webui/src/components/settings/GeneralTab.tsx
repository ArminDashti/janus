import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

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
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Startup</h3>
        <p className="text-xs text-zinc-500">
          Launch Janus automatically when you sign in to Windows.
        </p>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={runOnLogin}
            onChange={(e) => setRunOnLogin(e.target.checked)}
          />
          Run Janus when Windows starts
        </label>
      </section>

      <button type="button" onClick={() => void saveGeneral()} className="px-4 py-2 text-sm bg-emerald-700 rounded">
        Save general settings
      </button>
    </div>
  )
}
