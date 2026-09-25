import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { Toggle } from '@renderer/components/Toggle'

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
        <div className="flex items-center justify-between gap-4 max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
          <span className="text-sm text-zinc-300">Run Janus when Windows starts</span>
          <Toggle
            checked={runOnLogin}
            onChange={setRunOnLogin}
            ariaLabel="Run Janus when Windows starts"
          />
        </div>
      </section>

      <button
        type="button"
        onClick={() => void saveGeneral()}
        className="px-4 py-2 text-sm bg-emerald-700 rounded"
      >
        Save general settings
      </button>
    </div>
  )
}
