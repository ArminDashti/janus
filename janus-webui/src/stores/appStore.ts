import { create } from 'zustand'
import type { AppSettings, ScanResult } from '@shared/types'

export type PageId =
  | 'skills'
  | 'subagents'
  | 'mcps'
  | 'projects'
  | 'settings'
  | 'about'

interface AppState {
  page: PageId
  setPage: (page: PageId) => void
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  aboutOpen: boolean
  openAbout: () => void
  closeAbout: () => void
  settings: AppSettings | null
  setSettings: (settings: AppSettings) => void
  scan: ScanResult | null
  setScan: (scan: ScanResult) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  refreshScan: (options?: { probeMcps?: boolean }) => Promise<void>
  syncNow: () => Promise<void>
  loadSettings: () => Promise<void>
}

const emptyScan: ScanResult = {
  skills: [],
  mcps: [],
  subAgents: []
}

export const useAppStore = create<AppState>((set, get) => ({
  page: 'skills',
  setPage: (page) => {
    if (page === 'settings') {
      set({ settingsOpen: true, aboutOpen: false })
      return
    }
    if (page === 'about') {
      set({ aboutOpen: true, settingsOpen: false })
      return
    }
    set({ page, settingsOpen: false, aboutOpen: false })
  },
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true, aboutOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  aboutOpen: false,
  openAbout: () => set({ aboutOpen: true, settingsOpen: false }),
  closeAbout: () => set({ aboutOpen: false }),
  settings: null,
  setSettings: (settings) => set({ settings }),
  scan: null,
  setScan: (scan) => set({ scan }),
  loading: false,
  setLoading: (loading) => set({ loading }),
  loadSettings: async () => {
    const settings = await window.agentManager.getSettings()
    set({ settings })
  },
  refreshScan: async (options) => {
    // Soft-refresh: only flash global loading on the first scan (no existing data)
    const isInitial = get().scan == null
    if (isInitial) set({ loading: true })
    try {
      const [scan, settings] = await Promise.all([
        window.agentManager.scanAll(options),
        window.agentManager.getSettings()
      ])
      set({ scan, settings })
    } finally {
      if (isInitial) set({ loading: false })
    }
  },
  syncNow: async () => {
    const isInitial = get().scan == null
    if (isInitial) set({ loading: true })
    try {
      const scan = await window.agentManager.syncNow()
      set({ scan })
    } finally {
      if (isInitial) set({ loading: false })
    }
  }
}))

export { emptyScan }
