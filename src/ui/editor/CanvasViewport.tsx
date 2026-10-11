import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bresenhamPixels } from '@/core/document/paint'
import type { SceneNode } from '@/core/document/model'
import { useAppStore, type ToolId } from '@/store/app-store'
import { boxesOf } from '@/core/document/arrange'
import {
  alignmentGuides,
  centerGuides,
  screenBox,
  snapBox,
  snapPoint,
  snapThreshold,
  type GuideLine
} from '@/core/document/guides'
import { addNode, createNode, patchNode, removeNodes, renameScreen, setSelectedIds } from '@/ui/editor/document-actions'
import { defaultBitmapFont, measureText } from '@/core/fonts/bitmap-font'
import { gridCellScreenPx } from '@/core/render/pixel-grid'
import { nodeBounds } from '@/core/render/raster-node'
import { DeviceRaster } from '@/ui/editor/DeviceRaster'
import { GuideOverlay } from '@/ui/editor/GuideOverlay'
import { LayerPreview } from '@/ui/editor/LayerPreview'

const MIN_ZOOM = 1
const MAX_ZOOM = 64
const DRAW_TOOLS = new Set<ToolId>(['rect', 'ellipse', 'line', 'triangle', 'polygon', 'text', 'pencil', 'eraser', 'image'])
const SHAPE_TOOLS = new Set<ToolId>(['rect', 'ellipse', 'line', 'triangle', 'polygon'])
const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  h: 'hand',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  y: 'triangle',
  p: 'polygon',
  t: 'text',
  b: 'pencil',
  e: 'eraser',
  i: 'image',
  k: 'eyedropper'
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)))
}

function nextZoom(current: number, direction: 1 | -1): number {
  return clampZoom(current + direction)
}

function clientToDevice(
  event: { clientX: number; clientY: number },
  el: HTMLElement,
  zoom: number,
  maxW: number,
  maxH: number
) {
  const rect = el.getBoundingClientRect()
  return {
    x: Math.round(Math.min(maxW, Math.max(0, (event.clientX - rect.left) / zoom))),
    y: Math.round(Math.min(maxH, Math.max(0, (event.clientY - rect.top) / zoom)))
  }
}

function boxOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.max(1, Math.abs(b.x - a.x)),
    h: Math.max(1, Math.abs(b.y - a.y))
  }
}

function paintNodeFromPixels(name: string, pixels: { x: number; y: number }[], color: SceneNode['color']): SceneNode | null {
  if (!pixels.length) return null
  const x = Math.min(...pixels.map((pixel) => pixel.x))
  const y = Math.min(...pixels.map((pixel) => pixel.y))
  const w = Math.max(...pixels.map((pixel) => pixel.x)) - x + 1
  const h = Math.max(...pixels.map((pixel) => pixel.y)) - y + 1
  return createNode('paint', name, { x, y, w, h }, {
    color,
    fill: false,
    stroke: 1,
    points: pixels.map((pixel) => ({ x: pixel.x - x, y: pixel.y - y }))
  })
}

export const CanvasViewport = forwardRef<HTMLDivElement>(function CanvasViewport(_props, ref) {
  const { t } = useTranslation()
  const document = useAppStore((s) => s.document)
  const tool = useAppStore((s) => s.tool)
  const activeScreenId = useAppStore((s) => s.activeScreenId)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const viewportRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => viewportRef.current as HTMLDivElement, [document])
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<SceneNode | null>(null)
  const [guides, setGuides] = useState<GuideLine[]>([])
  const [placing, setPlacing] = useState(false)
  const drag = useRef<{ kind: 'pan'; lastX: number; lastY: number } | null>(null)
  const screenDrag = useRef<{
    id: string
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const stopScreenDrag = useRef<(() => void) | null>(null)
  const stopDraw = useRef<(() => void) | null>(null)
  const drawColor = useRef<SceneNode['color']>(1)

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      if (useAppStore.getState().galleryOpen) return
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceDown(true)
      }
      const key = event.key.toLowerCase()
      if (!event.ctrlKey && !event.metaKey && !event.altKey && TOOL_KEYS[key]) {
        event.preventDefault()
        useAppStore.getState().setTool(TOOL_KEYS[key])
      }
      if (event.key === 'Escape') {
        setSelectedIds([])
        useAppStore.getState().setTool('select')
      }
      if (event.shiftKey && event.key === '1') {
        event.preventDefault()
        fitView(viewportRef.current)
      }
      if (event.shiftKey && event.key === '0') {
        event.preventDefault()
        useAppStore.getState().setView(1, [0, 0])
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        const zoom = useAppStore.getState().document?.ui.zoom ?? 6
        useAppStore.getState().setZoom(zoom + 1)
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === '-' || event.key === '_')) {
        event.preventDefault()
        const zoom = useAppStore.getState().document?.ui.zoom ?? 6
        useAppStore.getState().setZoom(zoom - 1)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', () => setSpaceDown(false))
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const detachWheel = useRef<(() => void) | null>(null)

  const bindViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node
    detachWheel.current?.()
    detachWheel.current = null
    if (!node) return

    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const store = useAppStore.getState()
      const current = store.document
      if (!current) return

      const ctrl = event.ctrlKey || event.metaKey
      const { deltaX, deltaY } = event

      if (ctrl) {
        store.nudgePan(-deltaY - deltaX, 0)
        return
      }
      if (event.shiftKey) {
        store.nudgePan(0, -deltaY)
        return
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        store.nudgePan(-deltaX, 0)
        return
      }

      const direction: 1 | -1 = deltaY < 0 ? 1 : -1
      const oldZoom = current.ui.zoom
      const newZoom = nextZoom(oldZoom, direction)
      if (newZoom === oldZoom) return

      const rect = node.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      const [oldPanX, oldPanY] = current.ui.pan
      const originX = rect.width / 2 + oldPanX
      const originY = rect.height / 2 + oldPanY
      const worldX = (mx - originX) / oldZoom
      const worldY = (my - originY) / oldZoom
      store.setView(newZoom, [mx - worldX * newZoom - rect.width / 2, my - worldY * newZoom - rect.height / 2])
    }

    node.addEventListener('wheel', onWheelNative, { passive: false })
    detachWheel.current = () => node.removeEventListener('wheel', onWheelNative)
  }, [])

  useEffect(
    () => () => {
      detachWheel.current?.()
      stopScreenDrag.current?.()
      stopDraw.current?.()
    },
    []
  )

  if (!document) return null

  const zoom = document.ui.zoom
  const [panX, panY] = document.ui.pan
  const canPanTool = tool === 'hand' || spaceDown
  const cursor = panning
    ? 'grabbing'
    : canPanTool
      ? 'grab'
      : tool === 'text'
        ? 'text'
        : DRAW_TOOLS.has(tool) || tool === 'eyedropper'
          ? 'crosshair'
          : 'default'

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind: 'pan', lastX: event.clientX, lastY: event.clientY }
    setPanning(true)
  }

  const beginScreenDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    screenId: string,
    originX: number,
    originY: number
  ) => {
    if (event.button !== 0 || canPanTool || event.altKey) return
    if (editing === screenId) return
    event.stopPropagation()
    event.preventDefault()
    useAppStore.getState().setActiveScreen(screenId)
    stopScreenDrag.current?.()
    screenDrag.current = {
      id: screenId,
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
      moved: false
    }

    const onMove = (move: PointerEvent) => {
      const active = screenDrag.current
      if (!active) return
      const dx = move.clientX - active.startX
      const dy = move.clientY - active.startY
      if (!active.moved && dx * dx + dy * dy < 9) return
      if (!active.moved) {
        active.moved = true
        useAppStore.getState().pushHistory()
      }
      const zoomNow = useAppStore.getState().document?.ui.zoom ?? 1
      useAppStore.getState().moveScreen(active.id, active.originX + dx / zoomNow, active.originY + dy / zoomNow, false)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      screenDrag.current = null
      stopScreenDrag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    stopScreenDrag.current = onUp
  }

  const beginDraw = (event: React.PointerEvent<HTMLDivElement>, screenId: string, frame: HTMLDivElement) => {
    if (event.button !== 0 || canPanTool || event.altKey) return
    if (!DRAW_TOOLS.has(tool) && tool !== 'eyedropper') return
    event.stopPropagation()
    event.preventDefault()
    useAppStore.getState().setActiveScreen(screenId)
    const maxW = document.device.width
    const maxH = document.device.height
    const start = clientToDevice(event, frame, zoom, maxW, maxH)
    const device = screenBox(maxW, maxH)
    const others = boxesOf((document.screens.find((item) => item.id === screenId)?.children ?? []).filter((node) => node.visible))
    const threshold = snapThreshold(zoom)

    if (tool === 'text') {
      const font = defaultBitmapFont(document.device.library)
      const text = t('editor.text')
      const size = measureText(text, font)
      const snapped = snapBox({ id: 'draft', x: start.x, y: start.y, ...size }, device, others, threshold)
      addNode(
        screenId,
        createNode('text', t('tools.text'), { x: snapped.x, y: snapped.y, w: size.w, h: size.h }, { text, font, fill: false })
      )
      setGuides(snapped.guides)
      return
    }
    if (tool === 'image') {
      useAppStore.getState().openGallery(start)
      return
    }
    if (tool === 'eyedropper') {
      const nodeId = event.target instanceof HTMLElement ? event.target.closest('[data-node-id]')?.getAttribute('data-node-id') : null
      const node = document.screens.find((item) => item.id === screenId)?.children.find((item) => item.id === nodeId)
      drawColor.current = node?.color ?? 1
      useAppStore.getState().setTool('select')
      return
    }
    if (tool === 'eraser') {
      const nodeId = event.target instanceof HTMLElement ? event.target.closest('[data-node-id]')?.getAttribute('data-node-id') : null
      if (nodeId) removeNodes(screenId, [nodeId])
      return
    }
    if (tool === 'pencil') {
      const seen = new Set<string>()
      const pixels: { x: number; y: number }[] = []
      let last = start
      const addPixel = (point: { x: number; y: number }) => {
        const key = `${point.x},${point.y}`
        if (seen.has(key)) return
        seen.add(key)
        pixels.push(point)
      }
      addPixel(start)
      const preview = () => {
        const node = paintNodeFromPixels(t('tools.pencil'), pixels, drawColor.current)
        if (node) setDraft(node)
      }
      preview()
      const onMove = (move: PointerEvent) => {
        const next = clientToDevice(move, frame, zoom, maxW, maxH)
        for (const pixel of bresenhamPixels(last, next)) addPixel(pixel)
        last = next
        preview()
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        stopDraw.current = null
        const node = paintNodeFromPixels(t('tools.pencil'), pixels, drawColor.current)
        if (node) addNode(screenId, node)
        setDraft(null)
      }
      stopDraw.current?.()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      stopDraw.current = onUp
      return
    }
    if (!SHAPE_TOOLS.has(tool)) return

    const type = tool as SceneNode['type']
    const name = t(`tools.${tool}`)
    setPlacing(true)

    const draftFrom = (end: { x: number; y: number }) => {
      const snapped = snapPoint(end, device, others, threshold)
      setGuides(snapped.guides)
      if (type === 'line') {
        return createNode(type, name, { x: start.x, y: start.y, w: snapped.x - start.x, h: snapped.y - start.y }, { color: drawColor.current, fill: false, stroke: 1 })
      }
      return createNode(type, name, boxOf(start, snapped), { color: drawColor.current })
    }

    const onMove = (move: PointerEvent) => {
      setDraft(draftFrom(clientToDevice(move, frame, zoom, maxW, maxH)))
    }
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stopDraw.current = null
      const node = draftFrom(clientToDevice(up, frame, zoom, maxW, maxH))
      if (Math.abs(node.w ?? 0) > 0 || Math.abs(node.h ?? 0) > 0) addNode(screenId, node)
      setDraft(null)
      setPlacing(false)
      setGuides([])
    }
    stopDraw.current?.()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    stopDraw.current = () => onUp(event.nativeEvent)
  }

  const beginNodeDrag = (event: React.PointerEvent<HTMLDivElement>, screenId: string, node: SceneNode) => {
    if (event.button !== 0 || canPanTool || DRAW_TOOLS.has(tool)) return
    event.stopPropagation()
    event.preventDefault()
    useAppStore.getState().setActiveScreen(screenId)
    const next = event.shiftKey || event.ctrlKey || event.metaKey
      ? selectedIds.includes(node.id)
        ? selectedIds.filter((id) => id !== node.id)
        : [...selectedIds, node.id]
      : [node.id]
    setSelectedIds(next)
    if (node.locked) return
    const startX = event.clientX
    const startY = event.clientY
    const originX = node.x
    const originY = node.y
    const device = screenBox(document.device.width, document.device.height)
    const others = boxesOf(
      (document.screens.find((item) => item.id === screenId)?.children ?? []).filter((item) => item.visible && item.id !== node.id)
    )
    let recorded = false
    setPlacing(true)
    const onMove = (move: PointerEvent) => {
      const zoomNow = useAppStore.getState().document?.ui.zoom ?? 1
      const rawX = Math.round(originX + (move.clientX - startX) / zoomNow)
      const rawY = Math.round(originY + (move.clientY - startY) / zoomNow)
      const size = nodeBounds(node)
      const bounds = { id: node.id, x: rawX, y: rawY, w: size.w, h: size.h }
      const snapped = snapBox(bounds, device, others, snapThreshold(zoomNow))
      if (!recorded) {
        useAppStore.getState().pushHistory()
        recorded = true
      }
      setGuides(snapped.guides)
      patchNode(
        screenId,
        node.id,
        (item) => {
          item.x = snapped.x
          item.y = snapped.y
        },
        { record: false }
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setPlacing(false)
      setGuides([])
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const onEmpty =
      event.button === 0 &&
      !(event.target instanceof HTMLElement && event.target.closest('[data-screen-id]'))
    if (onEmpty) {
      useAppStore.getState().setActiveScreen(null)
    }
    const frame = event.currentTarget.getBoundingClientRect()
    const edge = 10
    const nearResize =
      event.clientX - frame.left < edge ||
      frame.right - event.clientX < edge ||
      frame.bottom - event.clientY < edge
    if (nearResize) return
    if (event.button === 1 || event.altKey || canPanTool || event.button === 0) {
      if (DRAW_TOOLS.has(tool) && event.button === 0 && !canPanTool && !event.altKey) return
      beginPan(event)
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = drag.current
    if (!active) return
    useAppStore.getState().nudgePan(event.clientX - active.lastX, event.clientY - active.lastY)
    drag.current = { kind: 'pan', lastX: event.clientX, lastY: event.clientY }
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      drag.current = null
      setPanning(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }
  }

  return (
    <div
      ref={bindViewport}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor, touchAction: 'none', overscrollBehavior: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${panX}px, ${panY}px)`,
          left: '50%',
          top: '50%'
        }}
      >
        {document.screens.map((screen) => {
          const active = screen.id === activeScreenId
          const width = document.device.width * zoom
          const height = document.device.height * zoom
          return (
            <div
              key={screen.id}
              data-screen-id={screen.id}
              role="group"
              aria-label={screen.name}
              className="absolute"
              style={{
                width,
                height,
                left: screen.x * zoom,
                top: screen.y * zoom,
                transform: 'translate(-50%, -50%)'
              }}
              onPointerDown={(event) => {
                if (DRAW_TOOLS.has(tool) && !canPanTool) return
                if (event.target instanceof HTMLElement && event.target.closest('[data-node-id]')) return
                beginScreenDrag(event, screen.id, screen.x, screen.y)
              }}
            >
              <div
                className={`absolute -top-5 left-0 text-[11px] ${active ? 'text-ink' : 'text-muted'} hover:text-ink`}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  setEditing(screen.id)
                }}
              >
                {editing === screen.id ? (
                  <input
                    autoFocus
                    defaultValue={screen.name}
                    className="h-5 border border-accent bg-input px-1 text-[11px] text-ink outline-none"
                    onPointerDown={(event) => event.stopPropagation()}
                    onBlur={(event) => {
                      renameScreen(screen.id, event.target.value)
                      setEditing(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                      if (event.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  screen.name
                )}
              </div>
              <div
                className="relative h-full w-full overflow-hidden"
                style={{
                  background: document.device.preview.pixelOff,
                  outline: active ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
                  outlineOffset: 0
                }}
                onPointerDown={(event) => beginDraw(event, screen.id, event.currentTarget)}
              >
                <DeviceRaster
                  nodes={draft ? [...screen.children, draft] : screen.children}
                  width={document.device.width}
                  height={document.device.height}
                  zoom={zoom}
                  colorMode={document.device.colorMode}
                  pixelOn={document.device.preview.pixelOn}
                />
                {document.ui.grid ? (
                  <div
                    className="pixel-grid pointer-events-none absolute inset-0"
                    style={{ ['--cell' as string]: `${gridCellScreenPx(zoom)}px` }}
                  />
                ) : null}
                {(() => {
                  const frame = screenBox(document.device.width, document.device.height)
                  const selected = !draft && !placing && selectedIds.length === 1
                    ? screen.children.find((node) => node.id === selectedIds[0] && node.visible)
                    : null
                  const idle = selected
                    ? alignmentGuides(
                        { id: selected.id, ...nodeBounds(selected) },
                        frame,
                        boxesOf(screen.children.filter((node) => node.visible && node.id !== selected.id)),
                        1
                      )
                    : []
                  return (
                    <>
                      {draft || placing ? <GuideOverlay lines={centerGuides(frame)} zoom={zoom} dim /> : null}
                      <GuideOverlay lines={guides.length ? guides : idle} zoom={zoom} />
                    </>
                  )
                })()}
                {screen.children.map((node) => (
                  <LayerPreview
                    key={node.id}
                    node={node}
                    zoom={zoom}
                    selected={selectedIds.includes(node.id)}
                    onPointerDown={(event) => beginNodeDrag(event, screen.id, node)}
                  />
                ))}
                {draft ? <LayerPreview node={draft} zoom={zoom} /> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export function fitView(viewport: HTMLDivElement | null): void {
  const store = useAppStore.getState()
  const document = store.document
  if (!document || !viewport) return
  const pad = 96
  const zx = (viewport.clientWidth - pad) / document.device.width
  const zy = (viewport.clientHeight - pad) / document.device.height
  store.setView(clampZoom(Math.min(zx, zy)), [0, 0])
}
