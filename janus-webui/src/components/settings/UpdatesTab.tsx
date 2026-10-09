import { useState } from 'react'
import { DownloadCloud, RefreshCw } from 'lucide-react'
import type { AppSettings, UpdateCheckResult } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { Toggle } from '@renderer/components/Toggle'
import { SettingsSection } from '@renderer/components/settings/SettingsSection'
import { cn } from '@renderer/lib/utils'

interface UpdatesTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-mono text-xs truncate">{value}</span>
    </div>
  )
}

export function UpdatesTab({ settings, onChange }: UpdatesTabProps) {
  const { loadSettings } = useAppStore()
  const [check, setCheck] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [autoCheck, setAutoCheck] = useState(settings.updates?.checkOnStartup ?? true)

  const runCheck = async () => {
    setChecking(true)
    try {
      const result = await window.agentManager.checkForUpdates()
      setCheck(result)
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Update check failed',
        type: 'error'
      })
    } finally {
      setChecking(false)
    }
  }

  const install = async () => {
    const confirmed = await showMessage({
      message: 'Download and install the pending Janus update? The service must restart afterwards.',
      confirm: true
    })
    if (!confirmed) return

    setApplying(true)
    try {
      const result = await window.agentManager.applyUpdate()
      await showMessage({
        message: result.message,
        type: result.updated ? 'success' : 'info'
      })
      if (result.updated) {
        setCheck(await window.agentManager.checkForUpdates())
      }
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Update install failed',
        type: 'error'
      })
    } finally {
      setApplying(false)
    }
  }

  const saveUpdateSettings = async () => {
    const confirmed = await showMessage({
      message: 'Save update settings?',
      confirm: true
    })
    if (!confirmed) return

    const next: AppSettings = {
      ...settings,
      updates: { checkOnStartup: autoCheck }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Settings saved', type: 'success' })
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={DownloadCloud}
        title="Available updates"
        description="Janus updates itself from its GitHub checkout: fetch origin, then fast-forward this install."
      >
        <div className="max-w-xl space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 space-y-2">
            <InfoRow label="Installed version" value={check?.currentVersion ?? '—'} />
            <InfoRow
              label="Branch"
              value={check ? check.branch || '—' : '—'}
            />
            <InfoRow
              label="Commit"
              value={check ? check.currentSha.slice(0, 7) || '—' : '—'}
            />
            <InfoRow
              label="Remote"
              value={check?.remoteUrl ?? '—'}
            />
            {check && (
              <InfoRow
                label="Last checked"
                value={new Date(check.checkedAt).toLocaleString()}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void runCheck()}
              disabled={checking}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-zinc-700',
                'text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw size={14} className={cn(checking && 'animate-spin')} />
              {checking ? 'Checking…' : 'Check for updates'}
            </button>
            {check?.hasUpdate && (
              <button
                type="button"
                onClick={() => void install()}
                disabled={applying || check.dirty || check.ahead > 0}
                className={cn(
                  'px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-600 rounded-lg',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {applying ? 'Installing…' : `Install ${check.behind} update${check.behind === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          {check?.error && (
            <p className="text-sm text-amber-400">{check.error}</p>
          )}

          {check && !check.error && !check.hasUpdate && (
            <p className="text-sm text-emerald-400">
              Janus is up to date{check.remoteSha ? ` (${check.remoteSha.slice(0, 7)})` : ''}.
            </p>
          )}

          {check?.hasUpdate && check.dirty && (
            <p className="text-sm text-amber-400">
              This install has uncommitted changes — commit or revert them in the
              Janus folder before installing.
            </p>
          )}

          {check?.hasUpdate && check.ahead > 0 && (
            <p className="text-sm text-amber-400">
              This install has local commits that diverge from origin — update
              manually with git.
            </p>
          )}

          {check?.hasUpdate && check.incoming.length > 0 && (
            <ul className="max-w-xl rounded-lg border border-zinc-800 bg-zinc-950/50 divide-y divide-zinc-800/70">
              {check.incoming.slice(0, 10).map((c) => (
                <li key={c.sha} className="px-4 py-2.5 flex items-baseline gap-3 text-sm">
                  <span className="font-mono text-xs text-zinc-500 shrink-0">
                    {c.sha.slice(0, 7)}
                  </span>
                  <span className="text-zinc-200 flex-1 min-w-0 truncate">{c.subject}</span>
                  <span className="text-xs text-zinc-500 shrink-0">{c.author}</span>
                </li>
              ))}
              {check.incoming.length > 10 && (
                <li className="px-4 py-2 text-xs text-zinc-500">
                  …and {check.incoming.length - 10} more
                </li>
              )}
            </ul>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={RefreshCw}
        title="Automatic checks"
        description="Fetch origin and compare on every Janus service start. Checks run in the background and never change your files."
      >
        <div className="flex items-center justify-between gap-4 max-w-md rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <span className="text-sm text-zinc-200">Check for updates on startup</span>
          <Toggle
            checked={autoCheck}
            onChange={setAutoCheck}
            ariaLabel="Check for updates on startup"
          />
        </div>
      </SettingsSection>

      <div>
        <button
          type="button"
          onClick={() => void saveUpdateSettings()}
          className="px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-600 rounded-lg"
        >
          Save update settings
        </button>
      </div>
    </div>
  )
}
