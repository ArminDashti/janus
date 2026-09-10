import { Sidebar, useSidebarCollapsed } from './Sidebar'
import type { PageId } from '@renderer/stores/appStore'

interface AppLayoutProps {
  page: PageId
  onNavigate: (page: PageId) => void
  children: React.ReactNode
}

export function AppLayout({ page, onNavigate, children }: AppLayoutProps) {
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-app">
      <Sidebar
        page={page}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col bg-surface-app">{children}</main>
    </div>
  )
}
