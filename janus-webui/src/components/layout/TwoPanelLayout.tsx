import type { ReactNode } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { Group, Panel, ResizeHandle } from './ResizablePanels'

interface TwoPanelLayoutProps {
  left: ReactNode
  right: ReactNode
  autoSaveId?: string
  /** Percent (0-100). Numbers are converted to "%" — v4 treats bare numbers as pixels. */
  defaultLeftSize?: number
  /** Pixels (bare numbers = px in v4). Guarantees usable min width. */
  minLeftSize?: number
  /** Percent (0-100). Numbers are converted to "%". */
  maxLeftSize?: number
}

export function TwoPanelLayout({
  left,
  right,
  autoSaveId,
  defaultLeftSize = 25,
  minLeftSize = 220,
  maxLeftSize = 40
}: TwoPanelLayoutProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: autoSaveId ?? 'two-panel-default-v2',
    panelIds: ['left', 'right'],
    storage: localStorage
  })

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
        <div className="h-full overflow-auto border-r border-zinc-800">{left}</div>
      </Panel>
      <ResizeHandle />
      <Panel id="right" minSize={400}>
        <div className="h-full min-w-0 overflow-hidden">{right}</div>
      </Panel>
    </Group>
  )
}
