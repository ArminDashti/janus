import { useEffect, useState, type ReactNode } from 'react'
import type { ApiProviderId, AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'

interface ApiTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function ApiTab({ settings, onChange }: ApiTabProps) {
  const { loadSettings } = useAppStore()
  const [activeProvider, setActiveProvider] = useState<ApiProviderId>(
    settings.activeApiProvider ?? 'openRouter'
  )
  const [openRouterKey, setOpenRouterKey] = useState(settings.openRouter?.apiKey ?? '')
  const [openRouterModel, setOpenRouterModel] = useState(
    settings.openRouter?.model ?? 'openai/gpt-4o-mini'
  )
  const [cursorKey, setCursorKey] = useState(settings.cursorApi?.apiKey ?? '')
  const [cursorModel, setCursorModel] = useState(settings.cursorApi?.model ?? 'composer-2.5')

  useEffect(() => {
    setActiveProvider(settings.activeApiProvider ?? 'openRouter')
    setOpenRouterKey(settings.openRouter?.apiKey ?? '')
    setOpenRouterModel(settings.openRouter?.model ?? 'openai/gpt-4o-mini')
    setCursorKey(settings.cursorApi?.apiKey ?? '')
    setCursorModel(settings.cursorApi?.model ?? 'composer-2.5')
  }, [settings])

  const saveApi = async () => {
    const confirmed = await showMessage({
      message: 'Save API settings?',
      confirm: true
    })
    if (!confirmed) return

    const next: AppSettings = {
      ...settings,
      activeApiProvider: activeProvider,
      openRouter: {
        apiKey: openRouterKey.trim(),
        model: openRouterModel.trim() || 'openai/gpt-4o-mini'
      },
      cursorApi: {
        apiKey: cursorKey.trim(),
        model: cursorModel.trim() || 'composer-2.5'
      }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'API settings saved', type: 'success' })
  }

  return (
    <div className="space-y-6 pb-6">
      <p className="text-xs text-zinc-500">
        Configure providers for Refactor. Exactly one provider is active at a time.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 max-w-4xl">
        <ProviderBox
          title="OpenRouter"
          description={
            <>
              Chat completions for Skills, Rules, Hooks, and Sub-agents. Get a key at{' '}
              <span className="text-zinc-400">openrouter.ai</span>.
            </>
          }
          active={activeProvider === 'openRouter'}
          onSelect={() => setActiveProvider('openRouter')}
        >
          <Field label="API token">
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field
            label="Model"
            hint="e.g. openai/gpt-4o-mini or anthropic/claude-sonnet-4"
          >
            <input
              value={openRouterModel}
              onChange={(e) => setOpenRouterModel(e.target.value)}
              placeholder="openai/gpt-4o-mini"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            />
          </Field>
        </ProviderBox>

        <ProviderBox
          title="CursorAPI"
          description={
            <>
              Local Cursor agent SDK for the same refactor flow. Create a key at{' '}
              <span className="text-zinc-400">cursor.com/dashboard</span> → API Keys.
            </>
          }
          active={activeProvider === 'cursorApi'}
          onSelect={() => setActiveProvider('cursorApi')}
        >
          <Field label="API key">
            <input
              type="password"
              value={cursorKey}
              onChange={(e) => setCursorKey(e.target.value)}
              placeholder="crsr_… or user/service key"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Model" hint="Cursor model id, e.g. composer-2.5">
            <input
              value={cursorModel}
              onChange={(e) => setCursorModel(e.target.value)}
              placeholder="composer-2.5"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            />
          </Field>
        </ProviderBox>
      </div>

      <button
        type="button"
        onClick={() => void saveApi()}
        className="px-4 py-2 text-sm bg-emerald-700 rounded"
      >
        Save API settings
      </button>
    </div>
  )
}

function ProviderBox({
  title,
  description,
  active,
  onSelect,
  children
}: {
  title: string
  description: ReactNode
  active: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border',
        active ? 'bg-zinc-900/70 border-blue-500/60' : 'bg-zinc-900/40 border-zinc-700'
      )}
    >
      <button type="button" onClick={onSelect} className="text-left space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0',
              active ? 'bg-emerald-500' : 'bg-zinc-600'
            )}
            title={active ? 'Active' : 'Inactive'}
          />
          <span className="text-sm font-medium text-zinc-100">{title}</span>
          {active && (
            <span className="text-[10px] uppercase tracking-wide text-emerald-400 border border-emerald-700/60 rounded px-1.5 py-0.5">
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">{description}</p>
        {!active && (
          <p className="text-[11px] text-zinc-500">Click to make this provider active</p>
        )}
      </button>
      <div className="space-y-3 pt-1 border-t border-zinc-800">{children}</div>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-zinc-400 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
