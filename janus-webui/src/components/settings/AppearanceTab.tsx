import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { applyTheme, isThemeId, THEME_OPTIONS, type ThemeId } from '@renderer/lib/themes'
import { applyFont, DEFAULT_FONT, FONT_OPTIONS, isFontId } from '@renderer/lib/fonts'
import { cn } from '@renderer/lib/utils'

interface AppearanceTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function AppearanceTab({ settings, onChange }: AppearanceTabProps) {
  const { loadSettings } = useAppStore()
  const [theme, setTheme] = useState<ThemeId>(
    isThemeId(settings.theme) ? settings.theme : 'vscode-dark'
  )
  const [font, setFont] = useState<string>(isFontId(settings.font) ? settings.font : DEFAULT_FONT)

  useEffect(() => {
    setTheme(isThemeId(settings.theme) ? settings.theme : 'vscode-dark')
    setFont(isFontId(settings.font) ? settings.font : DEFAULT_FONT)
  }, [settings])

  const selectTheme = async (id: ThemeId) => {
    if (id === theme) return
    setTheme(id)
    applyTheme(id)
    try {
      const next: AppSettings = { ...settings, theme: id }
      const saved = await window.agentManager.saveSettings(next)
      onChange(saved)
      await loadSettings()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Failed to save theme',
        type: 'error'
      })
    }
  }

  const selectFont = async (id: string) => {
    if (id === font) return
    setFont(id)
    applyFont(id)
    try {
      const next: AppSettings = { ...settings, font: id }
      const saved = await window.agentManager.saveSettings(next)
      onChange(saved)
      await loadSettings()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Failed to save font',
        type: 'error'
      })
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Appearance</h3>
        <p className="text-xs text-zinc-500">
          Pick a theme. Popular editor color schemes are included — changes apply instantly and
          are saved automatically.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-w-4xl">
          {THEME_OPTIONS.map((option) => {
            const selected = option.id === theme
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void selectTheme(option.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                  selected
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/60'
                )}
              >
                <span className="flex shrink-0 -space-x-1.5">
                  <span
                    className="w-4 h-4 rounded-full ring-1 ring-black/30"
                    style={{ background: option.swatch.bg }}
                  />
                  <span
                    className="w-4 h-4 rounded-full ring-1 ring-black/30"
                    style={{ background: option.swatch.panel }}
                  />
                  <span
                    className="w-4 h-4 rounded-full ring-1 ring-black/30"
                    style={{ background: option.swatch.accent }}
                  />
                </span>
                <span className="text-xs text-zinc-200 flex-1 truncate">{option.label}</span>
                {selected && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-zinc-500 pt-1">
          Font. Changes apply instantly and are saved automatically.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 max-w-4xl">
          {FONT_OPTIONS.map((option) => {
            const selected = option.id === font
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void selectFont(option.id)}
                style={{ fontFamily: option.id }}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors',
                  selected
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/60'
                )}
              >
                <span className="text-sm text-zinc-200 flex-1 truncate">{option.label}</span>
                {selected && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
