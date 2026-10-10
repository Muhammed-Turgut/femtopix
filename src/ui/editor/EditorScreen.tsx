import { Grip, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { useAppStore } from '@/store/app-store'
import { CanvasViewport, fitView } from '@/ui/editor/CanvasViewport'
import { handleEditKey } from '@/ui/editor/edit-actions'
import { CodePanel } from '@/ui/editor/CodePanel'
import { HelpDialog } from '@/ui/editor/HelpDialog'
import { LeftPanel } from '@/ui/editor/LeftPanel'
import { ResizeRule } from '@/ui/editor/ResizeRule'
import { RightPanel } from '@/ui/editor/RightPanel'
import { Toolbar } from '@/ui/editor/Toolbar'
import { TopBar } from '@/ui/editor/TopBar'
import { IconButton, Tooltip } from '@/ui/primitives'

const ZOOM_PRESETS = [1, 2, 4, 6, 8, 12, 16]

export function EditorScreen({ onSave }: { onSave: () => void }) {
  const { t } = useTranslation()
  const document = useAppStore((s) => s.document)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [help, setHelp] = useState(false)
  const [zoomMenu, setZoomMenu] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault()
        setHelp((value) => !value)
        return
      }
      if (event.key === 'Escape') setHelp(false)
      handleEditKey(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!document) return null
  const zoom = document.ui.zoom

  return (
    <div className="flex h-full flex-col bg-app">
      <TopBar onSave={onSave} onHelp={() => setHelp(true)} />
      <PanelGroup direction="vertical" className="min-h-0 flex-1">
        <Panel defaultSize={76} minSize={40}>
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={17} minSize={14} maxSize={25} className="bg-panel" id="left">
              <LeftPanel />
            </Panel>
            <ResizeRule direction="horizontal" />
            <Panel minSize={40} className="relative overflow-hidden bg-canvas">
              <CanvasViewport ref={canvasRef} />
              <Toolbar />
              <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1">
                <div className="flex h-7 items-center rounded-md border border-line bg-panel">
                  <IconButton onClick={() => useAppStore.getState().setZoom(zoom - 1)}>
                    <Minus size={16} strokeWidth={1.5} />
                  </IconButton>
                  <div className="relative">
                    <button
                      type="button"
                      className="h-7 min-w-12 px-1 text-[12px] tabular-nums hover:bg-hover"
                      onClick={() => setZoomMenu((value) => !value)}
                    >
                      {zoom * 100}%
                    </button>
                    {zoomMenu ? (
                      <div
                        className="absolute right-0 bottom-8 z-20 min-w-24 rounded-md border border-line bg-panel py-1"
                      >
                        <button
                          type="button"
                          className="flex h-7 w-full items-center px-2 hover:bg-hover"
                          onClick={() => {
                            fitView(canvasRef.current)
                            setZoomMenu(false)
                          }}
                        >
                          {t('editor.fit')}
                        </button>
                        {ZOOM_PRESETS.map((value) => (
                          <button
                            key={value}
                            type="button"
                            className="flex h-7 w-full items-center px-2 tabular-nums hover:bg-hover"
                            onClick={() => {
                              useAppStore.getState().setZoom(value)
                              setZoomMenu(false)
                            }}
                          >
                            {value * 100}%
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <IconButton onClick={() => useAppStore.getState().setZoom(zoom + 1)}>
                    <Plus size={16} strokeWidth={1.5} />
                  </IconButton>
                </div>
                <Tooltip content={t('editor.grid')}>
                  <IconButton
                    active={document.ui.grid}
                    className="border border-line bg-panel"
                    onClick={() => useAppStore.getState().toggleGrid()}
                  >
                    <Grip size={16} strokeWidth={1.5} />
                  </IconButton>
                </Tooltip>
              </div>
            </Panel>
            <ResizeRule direction="horizontal" />
            <Panel defaultSize={18} minSize={16} maxSize={22} className="bg-panel" id="right">
              <RightPanel />
            </Panel>
          </PanelGroup>
        </Panel>
        <ResizeRule direction="vertical" />
        <Panel defaultSize={26} minSize={14}>
          <CodePanel />
        </Panel>
      </PanelGroup>
      {help ? <HelpDialog onClose={() => setHelp(false)} /> : null}
    </div>
  )
}
