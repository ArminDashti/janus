export type ThemeId =
  | 'vscode-dark'
  | 'github-dark'
  | 'github-light'
  | 'dracula'
  | 'monokai'
  | 'one-dark'
  | 'nord'
  | 'catppuccin-mocha'

export interface ThemeOption {
  id: ThemeId
  label: string
  /** Preview colors: page background, raised panel, accent. */
  swatch: { bg: string; panel: string; accent: string }
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'vscode-dark', label: 'VS Code Dark+', swatch: { bg: '#1e1e1e', panel: '#2d2d30', accent: '#007acc' } },
  { id: 'github-dark', label: 'GitHub Dark', swatch: { bg: '#0d1117', panel: '#21262d', accent: '#1f6feb' } },
  { id: 'github-light', label: 'GitHub Light', swatch: { bg: '#ffffff', panel: '#eaeef2', accent: '#0969da' } },
  { id: 'dracula', label: 'Dracula', swatch: { bg: '#282a36', panel: '#34364c', accent: '#bd93f9' } },
  { id: 'monokai', label: 'Monokai', swatch: { bg: '#272822', panel: '#32332a', accent: '#66d9ef' } },
  { id: 'one-dark', label: 'One Dark', swatch: { bg: '#282c34', panel: '#2c313a', accent: '#61afef' } },
  { id: 'nord', label: 'Nord', swatch: { bg: '#2e3440', panel: '#434c5e', accent: '#5e81ac' } },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', swatch: { bg: '#1e1e2e', panel: '#313244', accent: '#89b4fa' } }
]

const STORAGE_KEY = 'janus-theme'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_OPTIONS.some((t) => t.id === value)
}

/** Apply a theme to the document and remember it for the next startup. */
export function applyTheme(theme: string): void {
  const id = isThemeId(theme) ? theme : 'vscode-dark'
  document.documentElement.setAttribute('data-theme', id)
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // storage unavailable — theme still applies for this session
  }
}

/** Last applied theme (avoids a flash of the default theme on startup). */
export function getStoredTheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'vscode-dark'
  } catch {
    return 'vscode-dark'
  }
}
