export interface FontOption {
  /** CSS family name — also the value persisted in settings.font. */
  id: string
  label: string
  /** Google Fonts families are fetched on demand; system fonts are not. */
  google: boolean
}

/** The 10 most popular UI fonts (Inter is the app default). */
export const FONT_OPTIONS: FontOption[] = [
  { id: 'Segoe UI', label: 'Segoe UI', google: false },
  { id: 'Arial', label: 'Arial', google: false },
  { id: 'Inter', label: 'Inter', google: true },
  { id: 'Roboto', label: 'Roboto', google: true },
  { id: 'Open Sans', label: 'Open Sans', google: true },
  { id: 'Lato', label: 'Lato', google: true },
  { id: 'Montserrat', label: 'Montserrat', google: true },
  { id: 'Poppins', label: 'Poppins', google: true },
  { id: 'Nunito', label: 'Nunito', google: true },
  { id: 'Source Sans 3', label: 'Source Sans 3', google: true }
]

export const DEFAULT_FONT = 'Inter'

const STORAGE_KEY = 'janus-font'
const MIGRATED_KEY = 'janus-font-migrated'

/**
 * One-time upgrade: installs created before Inter was the default stored 'Segoe UI'
 * (or nothing at all). Move those to Inter once; any later explicit font choice persists.
 */
export function migrateDefaultFont(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (localStorage.getItem(MIGRATED_KEY)) return stored ?? DEFAULT_FONT
    const next = stored === null || stored === 'Segoe UI' ? DEFAULT_FONT : stored
    localStorage.setItem(STORAGE_KEY, next)
    localStorage.setItem(MIGRATED_KEY, '1')
    return next
  } catch {
    return DEFAULT_FONT
  }
}

export function isFontId(value: unknown): value is string {
  return typeof value === 'string' && FONT_OPTIONS.some((f) => f.id === value)
}

function ensureGoogleFontLink(font: FontOption): void {
  const selector = `link[data-janus-font="${font.id}"]`
  if (document.querySelector(selector)) return
  const family = font.id.replace(/ /g, '+')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`
  link.setAttribute('data-janus-font', font.id)
  document.head.appendChild(link)
}

/** Apply a font family to the document and remember it for the next startup. */
export function applyFont(font: string): void {
  const id = isFontId(font) ? font : DEFAULT_FONT
  document.documentElement.style.setProperty('--app-font', `"${id}"`)
  const option = FONT_OPTIONS.find((f) => f.id === id)
  if (option?.google) ensureGoogleFontLink(option)
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // storage unavailable — font still applies for this session
  }
}

/** Last applied font (avoids a flash of the default font on startup). */
export function getStoredFont(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FONT
  } catch {
    return DEFAULT_FONT
  }
}
