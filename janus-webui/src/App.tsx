import { useEffect, useRef } from 'react'

import { AppLayout } from '@renderer/components/layout/AppLayout'

import { useAppStore } from '@renderer/stores/appStore'

import { SkillsPage } from '@renderer/pages/SkillsPage'

import { SubAgentsPage } from '@renderer/pages/SubAgentsPage'

import { McpsPage } from '@renderer/pages/McpsPage'

import { ProjectsPage } from '@renderer/pages/ProjectsPage'

import { HubPage } from '@renderer/pages/HubPage'

import { SettingsModal } from '@renderer/components/settings/SettingsModal'

import { AboutModal } from '@renderer/components/about/AboutModal'
import { MessageModal } from '@renderer/components/MessageModal'
import { applyTheme } from '@renderer/lib/themes'

import { applyFont } from '@renderer/lib/fonts'



export default function App() {

  const { page, setPage, loadSettings, refreshScan, settings } = useAppStore()

  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)



  useEffect(() => {

    void loadSettings()

    void refreshScan()



    const handler = (): void => {

      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)

      scanTimerRef.current = setTimeout(() => {

        void refreshScan()

      }, 75)

    }

    window.addEventListener('scan-changed', handler)

    return () => {

      window.removeEventListener('scan-changed', handler)

      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)

    }

  }, [loadSettings, refreshScan])



  useEffect(() => {

    if (settings?.theme) applyTheme(settings.theme)

  }, [settings?.theme])



  useEffect(() => {

    if (!settings?.font) return

    let font = settings.font

    try {

      // One-time: installs predating Inter stored the old default ('Segoe UI').

      if (!localStorage.getItem('janus-settings-font-migrated')) {

        localStorage.setItem('janus-settings-font-migrated', '1')

        if (font === 'Segoe UI') {

          font = 'Inter'

          void window.agentManager.saveSettings({ ...settings, font }).then(() => loadSettings())

        }

      }

    } catch {

      // storage unavailable — apply the current font for this session

    }

    applyFont(font)

  }, [settings, loadSettings])



  const content = (() => {

    switch (page) {

      case 'skills':

        return <SkillsPage />

      case 'subagents':

        return <SubAgentsPage />

      case 'mcps':

        return <McpsPage />

      case 'projects':

        return <ProjectsPage />

      case 'hub':

        return <HubPage />

      default:

        return <SkillsPage />

    }

  })()



  return (

    <AppLayout page={page} onNavigate={setPage}>

      <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
      <MessageModal />
      <SettingsModal />
      <AboutModal />

    </AppLayout>

  )

}


