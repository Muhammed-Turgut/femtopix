import { cssHexFromColor, inkRgb, isColorDisplay } from '@/core/color/rgb565'
import { placeholderCode, toCIdentifier, type ColorMode, type ExportTarget, type IvecDocument, type SceneNode } from '@/core/document/model'
import { getProfile } from '@/core/devices/profiles'
import { formatXbmHeader, packXbm } from '@/core/export/xbm'
import { rgbaToMono, type MonoBitmap } from '@/core/render/draw-node'
import { nodeBounds, rasterizeNode } from '@/core/render/raster-node'
import { useAppStore } from '@/store/app-store'

export function patchDocument(recipe: (document: IvecDocument) => void, options?: { record?: boolean }): void {
  if (options?.record !== false) useAppStore.getState().pushHistory()
  useAppStore.setState((state) => {
    if (!state.document) return
    recipe(state.document)
    state.dirty = true
  })
}

export function renameProject(name: string): void {
  patchDocument((document) => {
    document.meta.name = name
    document.meta.modified = new Date().toISOString()
  })
}

export function renameScreen(id: string, name: string): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === id)
    if (screen) screen.name = name
  })
}

export function setDeviceProfile(profileId: string): void {
  const profile = getProfile(profileId)
  patchDocument((document) => {
    document.device.profile = profile.id
    document.device.width = profile.width
    document.device.height = profile.height
    document.device.colorMode = profile.colorMode
    document.device.preview = { ...profile.preview }
    if (!profile.libraries.includes(document.device.library)) {
      document.device.library = profile.defaultLibrary
      document.export.activeTarget = profile.defaultLibrary
    }
    for (const screen of document.screens) {
      for (const node of screen.children) convertNodeColor(node, document.device.colorMode)
    }
  })
}

export function setDeviceLibrary(library: ExportTarget): void {
  patchDocument((document) => {
    document.device.library = library
    document.export.activeTarget = library
  })
}

function convertNodeColor(node: SceneNode, mode: ColorMode): void {
  if (isColorDisplay(mode)) {
    if (node.color === 1 || node.color === '1' || node.color === 'invert') node.color = '#FFFFFF'
    else if (node.color === 0 || node.color === '0') node.color = '#000000'
    else if (typeof node.color === 'string' && node.color.startsWith('#')) node.color = cssHexFromColor(node.color)
    return
  }
  if (typeof node.color === 'string' && node.color.startsWith('#')) {
    node.color = inkRgb(node) === 0 ? 0 : 1
  }
}

export function setDeviceMode(mode: ColorMode): void {
  patchDocument((document) => {
    document.device.colorMode = mode
    if (isColorDisplay(mode) && document.device.library === 'u8g2') {
      document.device.library = 'adafruit_gfx'
      document.export.activeTarget = 'adafruit_gfx'
    }
    for (const screen of document.screens) {
      for (const node of screen.children) convertNodeColor(node, mode)
    }
  })
}

export function setScreenSize(width: number, height: number): void {
  patchDocument((document) => {
    document.device.width = width
    document.device.height = height
    document.device.profile = 'custom'
  })
}

export function setExportFlag(key: string, value: boolean): void {
  patchDocument((document) => {
    const target = document.export.activeTarget
    const current = document.export.targets[target] ?? {}
    document.export.targets[target] = { ...current, [key]: value }
  })
}

export function toggleNodeFlag(screenId: string, nodeId: string, key: 'visible' | 'locked'): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    const node = screen?.children.find((item) => item.id === nodeId)
    if (node) node[key] = !node[key]
  })
}

export function renameNode(screenId: string, nodeId: string, name: string): void {
  patchNode(screenId, nodeId, (node) => {
    node.name = name
  })
}

function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadGeneratedCode(): void {
  const state = useAppStore.getState()
  const project = state.document
  const screen = project?.screens.find((item) => item.id === state.activeScreenId) ?? project?.screens[0]
  if (!project || !screen) return
  downloadTextFile(`${screen.cIdentifier}.h`, placeholderCode(project, screen))
}

function sampleCanvas(source: CanvasImageSource, w: number, h: number): MonoBitmap {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: w, height: h, data: new Uint8Array(w * h) }
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  return rgbaToMono(ctx.getImageData(0, 0, w, h).data, w, h)
}

function loadImageBitmap(src: string, w: number, h: number): Promise<MonoBitmap> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(sampleCanvas(image, w, h))
    image.onerror = () => reject(new Error('image'))
    image.src = src
  })
}

function textBitmap(text: string, w: number, h: number): MonoBitmap {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: w, height: h, data: new Uint8Array(w * h) }
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.font = `${Math.max(6, h)}px "IBM Plex Mono", "JetBrains Mono", monospace`
  ctx.textBaseline = 'top'
  ctx.fillText(text, 0, 0)
  return rgbaToMono(ctx.getImageData(0, 0, w, h).data, w, h)
}

export async function downloadShapeHeader(node: SceneNode, ident = toCIdentifier(node.name)): Promise<void> {
  const { w, h } = nodeBounds(node)
  const bitmaps = new Map<string, MonoBitmap>()
  if (node.type === 'image' && node.asset) {
    bitmaps.set(`${node.asset}:${w}x${h}`, await loadImageBitmap(node.asset, w, h))
  }
  if (node.type === 'text') {
    bitmaps.set(`text:${node.text || node.name}:${w}x${h}:${node.font ?? ''}`, textBitmap(node.text || node.name, w, h))
  }
  const buffer = rasterizeNode(node, bitmaps)
  const contents = formatXbmHeader({
    ident,
    name: node.name,
    width: buffer.width,
    height: buffer.height,
    bits: packXbm(buffer.data, buffer.width, buffer.height)
  })
  downloadTextFile(`${ident}.h`, contents)
}

export function patchNode(
  screenId: string,
  nodeId: string,
  recipe: (node: SceneNode) => void,
  options?: { record?: boolean }
): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    const node = screen?.children.find((item) => item.id === nodeId)
    if (node) recipe(node)
  }, options)
}

export function moveNode(screenId: string, from: number, to: number): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    if (!screen) return
    const [item] = screen.children.splice(from, 1)
    if (item) screen.children.splice(to, 0, item)
  })
}

export function setSelectedIds(ids: string[]): void {
  useAppStore.setState({ selectedIds: ids })
}

export function selectedNode(): SceneNode | null {
  const { document, selectedIds, activeScreenId } = useAppStore.getState()
  if (!document || selectedIds.length !== 1) return null
  const screen = document.screens.find((item) => item.id === activeScreenId) ?? document.screens[0]
  return screen?.children.find((item) => item.id === selectedIds[0]) ?? null
}

export function addNode(screenId: string, node: SceneNode): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    if (screen) screen.children.push(node)
  })
  setSelectedIds([node.id])
}

export function placeImageOnActiveScreen(name: string, asset: string, size = 16): void {
  const { document, activeScreenId } = useAppStore.getState()
  const screen = document?.screens.find((item) => item.id === activeScreenId) ?? document?.screens[0]
  if (!document || !screen) return
  const w = Math.min(size, document.device.width)
  const h = Math.min(size, document.device.height)
  const shift = screen.children.filter((node) => node.type === 'image').length * 4
  const x = Math.max(0, Math.min(document.device.width - w, Math.round((document.device.width - w) / 2) + shift))
  const y = Math.max(0, Math.min(document.device.height - h, Math.round((document.device.height - h) / 2) + shift))
  addNode(screen.id, createNode('image', name, { x, y, w, h }, { asset, fill: false }))
}

export async function assetFromUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const response = await fetch(url)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function removeNodes(screenId: string, ids: string[]): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    if (!screen) return
    screen.children = screen.children.filter((node) => !ids.includes(node.id))
  })
  setSelectedIds([])
}

const OUTLINE_TYPES = new Set<SceneNode['type']>([
  'rect',
  'ellipse',
  'triangle',
  'polygon',
  'line',
  'polyline',
  'paint',
  'arc'
])

export function createNode(
  type: SceneNode['type'],
  name: string,
  box: { x: number; y: number; w: number; h: number },
  extra?: Partial<SceneNode>
): SceneNode {
  const outline = OUTLINE_TYPES.has(type)
  const mode = useAppStore.getState().document?.device.colorMode
  let color: SceneNode['color'] = extra?.color ?? (isColorDisplay(mode) ? '#FFFFFF' : 1)
  if (isColorDisplay(mode) && (color === 1 || color === '1')) color = '#FFFFFF'
  return {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    name,
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.round(box.w),
    h: Math.round(box.h),
    visible: true,
    locked: false,
    fill: false,
    stroke: outline ? 1 : 0,
    ...extra,
    color
  }
}

export function libraryLabel(id: string): string {
  const labels: Record<string, string> = {
    u8g2: 'u8g2',
    adafruit_gfx: 'Adafruit GFX',
    tft_espi: 'TFT_eSPI',
    arduino_gfx: 'Arduino_GFX',
    lvgl: 'LVGL',
    flipper: 'Flipper',
    raw: 'Raw'
  }
  return labels[id] ?? id
}
