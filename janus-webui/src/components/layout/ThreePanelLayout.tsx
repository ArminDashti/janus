import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import { Group, Panel, ResizeHandle } from './ResizablePanels'

const MIDDLE_COLLAPSED_PX = 40

interface ThreePanelLayoutProps {
  left: ReactNode
  middle: ReactNode
  right: ReactNode
  autoSaveId?: string
  /** Percent (0-100). Numbers are converted to "%" — v4 treats bare numbers as pixels. */
  defaultLeftSize?: number
  /** Percent (0-100). Numbers are converted to "%" — v4 treats bare numbers as pixels. */
  defaultMiddleSize?: number
  /** Pixels (bare numbers = px in v4). Guarantees usable min width. */
  minLeftSize?: number
  /** Percent (0-100). Numbers are converted to "%". */
  maxLeftSize?: number
  /** Pixels (bare numbers = px in v4). Guarantees usable min width. */
  minMiddleSize?: number
  /** Percent (0-100). Numbers are converted to "%". */
  maxMiddleSize?: number
}

export function ThreePanelLayout({
  left,
  middle,
  right,
  autoSaveId,
  defaultLeftSize = 20,
  defaultMiddleSize = 20,
  minLeftSize = 220,
  maxLeftSize = 35,
  minMiddleSize = 260,
  maxMiddleSize = 35
}: ThreePanelLayoutProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: autoSaveId ?? 'three-panel-default-v2',
    panelIds: ['left', 'middle', 'right'],
    storage: localStorage
  })
  const middleRef = usePanelRef()
  const [middleCollapsed, setMiddleCollapsed] = useState(false)

  const toggleMiddle = () => {
    const panel = middleRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="flex-1 min-h-0"
    >
      <Panel
        id="left"
        defaultSize={`${defaultLeftSize}%`}
        minSize={minLeftSize}
        maxSize={`${maxLeftSize}%`}
      >
        <div className="h-full min-w-0 overflow-hidden border-r border-zinc-800">{left}</div>
      </Panel>
      <ResizeHandle />
      <Panel
        id="middle"
        panelRef={middleRef}
        collapsible
        collapsedSize={MIDDLE_COLLAPSED_PX}
        defaultSize={`${defaultMiddleSize}%`}
        minSize={minMiddleSize}
        maxSize={`${maxMiddleSize}%`}
        onResize={() => setMiddleCollapsed(middleRef.current?.isCollapsed() ?? false)}
      >
        <div className="h-full min-w-0 overflow-hidden border-r border-zinc-800 flex flex-col">
          <div
            className={`flex shrink-0 items-center px-2 py-2 border-b border-zinc-800 ${
              middleCollapsed ? 'justify-center' : 'justify-end'
            }`}
          >
            <button
              type="button"
              onClick={toggleMiddle}
              className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 shrink-0"
              aria-label={middleCollapsed ? 'Expand panel' : 'Collapse panel'}
            >
              {middleCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          {!middleCollapsed && <div className="flex-1 min-h-0 overflow-hidden">{middle}</div>}
        </div>
      </Panel>
      <ResizeHandle />
      <Panel id="right" minSize={400}>
        <div className="h-full min-w-0 overflow-hidden">{right}</div>
      </Panel>
    </Group>
  )
}
