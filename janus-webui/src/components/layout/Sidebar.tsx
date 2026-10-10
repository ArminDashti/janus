import { useEffect, useState } from 'react'

import {
  Layers,
  Bot,
  Cable,
  Settings2,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  ArrowLeftRight,
  Store
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { CollapsibleNavGroup } from './CollapsibleNavGroup'
import type { PageId } from '@renderer/stores/appStore'
import { useAppStore } from '@renderer/stores/appStore'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'
const APP_VERSION = '1.0.0'

interface NavItem {
  id: PageId
  label: string
  icon: typeof Layers
}

const resourceNav: NavItem[] = [
  { id: 'skills', label: 'Skills', icon: Layers },
  { id: 'hub', label: 'Hub', icon: Store },
  { id: 'subagents', label: 'Sub-agents', icon: Bot },
  { id: 'mcps', label: 'MCPs', icon: Cable },
  { id: 'projects', label: 'Projects', icon: FolderGit2 }
]

const footerNav: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'about', label: 'About me', icon: CircleHelp }
]

interface SidebarProps {
  page: PageId
  onNavigate: (page: PageId) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

function NavButton({
  item,
  active,
  collapsed,
  onNavigate
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate: (page: PageId) => void
}) {
  const Icon = item.icon

  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate(item.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors',
        collapsed && 'justify-center px-2',
        active ? 'bg-accent text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      )}
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
    } catch {
      // ignore
    }
  }, [collapsed])

  const toggle = () => setCollapsed((c) => !c)
  return [collapsed, toggle]
}

export function Sidebar({ page, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { syncNow, loadSettings, settingsOpen, openSettings, aboutOpen, openAbout } = useAppStore()
  const [syncing, setSyncing] = useState(false)
  const [iconSrc, setIconSrc] = useState<string | null>(null)

  useEffect(() => {
    window.agentManager.getBrandingPath('janus-icon').then((path) => {
      if (path) setIconSrc(path)
    })
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await loadSettings()
      await syncNow()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <aside
      className={cn(
        'shrink-0 bg-surface border-r border-surface-border flex flex-col transition-[width] duration-200',
        collapsed ? 'w-12' : 'w-52'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 p-2 border-b border-surface-border',
          collapsed ? 'flex-col justify-center' : 'justify-between'
        )}
      >
        <div className={cn('flex items-center gap-2 min-w-0', collapsed && 'justify-center')}>
          {iconSrc ? (
            <img src={iconSrc} alt="Janus" className="w-7 h-7 rounded-md object-contain shrink-0" />
          ) : (
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent/20 text-accent text-xs font-bold shrink-0">
              J
            </div>
          )}
          {!collapsed && <span className="text-sm font-medium text-zinc-200 truncate">Janus</span>}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-auto">
        <CollapsibleNavGroup label="Resources" collapsed={collapsed}>
          {resourceNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </CollapsibleNavGroup>

        <button
          type="button"
          title="Sync – reload settings, re-copy the latest version of every assigned resource into all enabled IDE/CLI locations, and rescan all skills, sub-agents, and MCPs"
          onClick={() => void handleSync()}
          disabled={syncing}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors',
            collapsed && 'justify-center px-2',
            'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40'
          )}
        >
          <ArrowLeftRight
            size={16}
            strokeWidth={1.75}
            className={cn('shrink-0', syncing && 'animate-spin')}
          />
          {!collapsed && <span className="truncate">Sync</span>}
        </button>
      </nav>

      <div className="mt-auto border-t border-surface-border px-2 py-2 space-y-0.5">
        {footerNav.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={
              item.id === 'settings'
                ? settingsOpen
                : item.id === 'about'
                  ? aboutOpen
                  : page === item.id
            }
            collapsed={collapsed}
            onNavigate={
              item.id === 'settings'
                ? () => openSettings()
                : item.id === 'about'
                  ? () => openAbout()
                  : onNavigate
            }
          />
        ))}
        <div
          className={cn(
            'px-3 py-1.5 text-xs text-zinc-500',
            collapsed && 'px-0 text-center'
          )}
          title={`Version ${APP_VERSION}`}
        >
          {collapsed ? `v${APP_VERSION}` : `Version ${APP_VERSION}`}
        </div>
      </div>
    </aside>
  )
}
