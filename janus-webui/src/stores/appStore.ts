import { create } from 'zustand'
import type { AppSettings, ScanResult } from '@shared/types'

export type PageId =
  | 'skills'
  | 'rules'
  | 'hooks'
  | 'subagents'
  | 'mcps'
  | 'tools'
  | 'repositories'
  | 'settings'
  | 'instructions'
  | 'about'

interface AppState {
  page: PageId
  setPage: (page: PageId) => void
  settings: AppSettings | null
  setSettings: (settings: AppSettings) => void
  scan: ScanResult | null
  setScan: (scan: ScanResult) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  refreshScan: (options?: { probeMcps?: boolean }) => Promise<void>
  loadSettings: () => Promise<void>
}

const emptyScan: ScanResult = {
  skills: [],
  rules: [],
  mcps: [],
  hooks: [],
  subAgents: [],
  tools: []
}

export const useAppStore = create<AppState>((set, get) => ({
  page: 'skills',
  setPage: (page) => set({ page }),
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
      const scan = await window.agentManager.scanAll(options)
      set({ scan })
    } finally {
      if (isInitial) set({ loading: false })
    }
  }
}))

export { emptyScan }
