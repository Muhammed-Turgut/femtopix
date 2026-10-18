import { cssHexFromColor, inkRgb, isColorDisplay } from '@/core/color/rgb565'
import {
  alignedPosition,
  boxesOf,
  distributedPositions,
  flippedOrigin,
  unionBox,
  type AlignKey
} from '@/core/document/arrange'
import { toCIdentifier, type ColorMode, type ExportTarget, type IvecDocument, type SceneNode, type Screen } from '@/core/document/model'
import { getProfile } from '@/core/devices/profiles'
import { defaultBitmapFont, fitTextNode } from '@/core/fonts/bitmap-font'
import { formatAnimationHeader, formatXbmHeader, packXbm } from '@/core/export/xbm'
import { rgbaToMono, type MonoBitmap } from '@/core/render/draw-node'
import { nodeBounds, rasterizeNode } from '@/core/render/raster-node'
import i18n from '@/app/i18n'
import { headerFileName } from '@/shared/header-file'
import { currentScreen, useAppStore } from '@/store/app-store'

export type { AlignKey }

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

export function addFolder(): string {
  const locale = useAppStore.getState().locale
  const base = locale === 'en' ? 'Folder' : 'Klasör'
  const id = nextId('f')
  patchDocument((document) => {
    if (!document.folders) document.folders = []
    const name = uniqueScreenName(base, document.folders.map((folder) => folder.name))
    document.folders.push({ id, name, collapsed: false })
  })
  return id
}

export function renameFolder(id: string, name: string): void {
  patchDocument((document) => {
    const folder = document.folders?.find((item) => item.id === id)
    if (folder) folder.name = name
  })
}

export function toggleFolder(id: string): void {
  patchDocument((document) => {
    const folder = document.folders?.find((item) => item.id === id)
    if (folder) folder.collapsed = !folder.collapsed
  }, { record: false })
}

export function removeFolder(id: string): void {
  patchDocument((document) => {
    document.folders = (document.folders ?? []).filter((folder) => folder.id !== id)
    for (const screen of document.screens) {
      if (screen.folderId === id) delete screen.folderId
    }
  })
}

export function setScreenFolder(screenId: string, folderId: string | null): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    if (!screen) return
    const folders = document.folders ?? []
    if (folderId && !folders.some((folder) => folder.id === folderId)) return
    if (folderId) {
      screen.folderId = folderId
      const folder = folders.find((item) => item.id === folderId)
      if (folder) folder.collapsed = false
    } else {
      delete screen.folderId
    }
  })
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function cloneNodes(nodes: SceneNode[]): SceneNode[] {
  return nodes.map((node) => ({
    ...structuredClone(node),
    id: nextId('n'),
    children: node.children ? cloneNodes(node.children) : undefined
  }))
}

function uniqueScreenName(base: string, names: string[]): string {
  if (!names.includes(base)) return base
  let index = 2
  while (names.includes(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

function screenFromClone(source: Screen, document: IvecDocument, name: string): Screen {
  const used = new Set(document.screens.map((item) => item.cIdentifier))
  return {
    ...structuredClone(source),
    id: nextId('s'),
    name,
    cIdentifier: toCIdentifier(name, used),
    x: source.x + document.device.width + 24,
    y: source.y,
    children: cloneNodes(source.children)
  }
}

export function duplicateScreen(id: string): string | null {
  const { document, locale } = useAppStore.getState()
  const source = document?.screens.find((item) => item.id === id)
  if (!document || !source) return null
  const suffix = locale === 'en' ? 'copy' : 'kopya'
  const name = uniqueScreenName(`${source.name} ${suffix}`, document.screens.map((item) => item.name))
  const screen = screenFromClone(source, document, name)
  patchDocument((project) => {
    project.screens.push(screen)
  })
  useAppStore.setState({ activeScreenId: screen.id, selectedIds: [] })
  return screen.id
}

export function removeScreen(id: string): boolean {
  const document = useAppStore.getState().document
  if (!document || document.screens.length <= 1) return false
  const index = document.screens.findIndex((item) => item.id === id)
  if (index < 0) return false
  patchDocument((project) => {
    project.screens = project.screens.filter((item) => item.id !== id)
  })
  const next = useAppStore.getState().document
  const fallback = next?.screens[Math.min(index, (next?.screens.length ?? 1) - 1)]
  useAppStore.setState({ activeScreenId: fallback?.id ?? null, selectedIds: [] })
  return true
}

export function pasteScreenClone(source: Screen): string | null {
  const document = useAppStore.getState().document
  if (!document) return null
  const locale = useAppStore.getState().locale
  const suffix = locale === 'en' ? 'copy' : 'kopya'
  const name = uniqueScreenName(`${source.name} ${suffix}`, document.screens.map((item) => item.name))
  const screen = screenFromClone(source, document, name)
  patchDocument((project) => {
    project.screens.push(screen)
  })
  useAppStore.setState({ activeScreenId: screen.id, selectedIds: [] })
  return screen.id
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

function convertColor(color: SceneNode['color'], mode: ColorMode): SceneNode['color'] {
  if (isColorDisplay(mode)) {
    if (color === 1 || color === '1' || color === 'invert') return '#FFFFFF'
    if (color === 0 || color === '0') return '#000000'
    if (typeof color === 'string' && color.startsWith('#')) return cssHexFromColor(color)
    return color
  }
  if (typeof color === 'string' && color.startsWith('#')) {
    return inkRgb({ color }) === 0 ? 0 : 1
  }
  return color
}

function convertNodeColor(node: SceneNode, mode: ColorMode): void {
  node.color = convertColor(node.color, mode)
  if (node.strokeColor !== undefined) node.strokeColor = convertColor(node.strokeColor, mode)
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

export function isIconNode(node: SceneNode): boolean {
  return node.type === 'image' || node.type === 'paint'
}

export function isAnimationNode(node: SceneNode): boolean {
  return node.type === 'image' && (node.frames?.length ?? 0) > 1
}

export async function iconHeaderContents(node: SceneNode, ident = toCIdentifier(node.name)): Promise<string> {
  const { w, h } = nodeBounds(node)
  if (isAnimationNode(node) && node.frames?.length) {
    const frames = []
    for (const src of node.frames) frames.push(packXbm((await loadImageBitmap(src, w, h)).data, w, h))
    return formatAnimationHeader({
      ident,
      name: node.name,
      width: w,
      height: h,
      fps: Math.max(1, Math.round(node.fps ?? 8)),
      frames
    })
  }
  const bitmaps = new Map<string, MonoBitmap>()
  if (node.type === 'image' && node.asset) {
    bitmaps.set(`${node.asset}:${w}x${h}`, await loadImageBitmap(node.asset, w, h))
  }
  const buffer = rasterizeNode(node, bitmaps)
  return formatXbmHeader({
    ident,
    name: node.name,
    width: buffer.width,
    height: buffer.height,
    bits: packXbm(buffer.data, buffer.width, buffer.height)
  })
}

async function writeHeaderFile(filename: string, contents: string): Promise<string | null> {
  if (window.ivec?.saveHeaderFile) return window.ivec.saveHeaderFile(filename, contents)
  downloadTextFile(headerFileName(filename), contents)
  return headerFileName(filename)
}

export async function saveIconHeader(node: SceneNode, ident = toCIdentifier(node.name)): Promise<void> {
  if (!isIconNode(node)) return
  try {
    const path = await writeHeaderFile(`${ident}.h`, await iconHeaderContents(node, ident))
    if (path) useAppStore.getState().showToast(i18n.t('editor.iconSaved'))
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.saveFailed'))
  }
}

export async function exportIconHeaders(): Promise<void> {
  const state = useAppStore.getState()
  const screen = currentScreen(state.document, state.activeScreenId)
  if (!screen) return
  const used = new Set<string>()
  const icons = screen.children.filter((node) => node.visible && node.role !== 'reference' && isIconNode(node))
  if (!icons.length) {
    useAppStore.getState().showToast(i18n.t('editor.exportNoIcons'))
    return
  }
  try {
    const files = []
    for (const node of icons) {
      const ident = toCIdentifier(node.name, used)
      files.push({ name: `${ident}.h`, contents: await iconHeaderContents(node, ident) })
    }
    if (files.length === 1 && files[0]) {
      const path = await writeHeaderFile(files[0].name, files[0].contents)
      if (path) useAppStore.getState().showToast(i18n.t('editor.iconSaved'))
      return
    }
    if (window.ivec?.saveHeaderFolder) {
      const written = await window.ivec.saveHeaderFolder(files)
      if (written?.length) useAppStore.getState().showToast(i18n.t('editor.iconsSaved', { count: written.length }))
      return
    }
    for (const file of files) downloadTextFile(headerFileName(file.name), file.contents)
    useAppStore.getState().showToast(i18n.t('editor.iconsSaved', { count: files.length }))
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.saveFailed'))
  }
}

export function downloadGeneratedCode(): void {
  void exportIconHeaders()
}

export async function downloadShapeHeader(node: SceneNode, ident = toCIdentifier(node.name)): Promise<void> {
  await saveIconHeader(node, ident)
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
    const finish = () => resolve(sampleCanvas(image, w, h))
    image.onload = () => {
      const decoded = image.decode?.()
      if (decoded) void decoded.then(finish).catch(finish)
      else finish()
    }
    image.onerror = () => reject(new Error('image'))
    image.src = src
  })
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

function selectedUnlocked(): { screenId: string; nodes: SceneNode[] } | null {
  const { document, selectedIds, activeScreenId } = useAppStore.getState()
  const screen = currentScreen(document, activeScreenId)
  if (!document || !screen || selectedIds.length === 0) return null
  const nodes = screen.children.filter((node) => selectedIds.includes(node.id) && !node.locked)
  if (!nodes.length) return null
  return { screenId: screen.id, nodes }
}

function moveNodeBox(node: SceneNode, from: { x: number; y: number }, to: { x: number; y: number }): void {
  node.x = Math.round(node.x + (to.x - from.x))
  node.y = Math.round(node.y + (to.y - from.y))
}

export function alignSelection(key: AlignKey): void {
  const selected = selectedUnlocked()
  const document = useAppStore.getState().document
  if (!selected || !document) return
  const boxes = boxesOf(selected.nodes)
  const frame =
    boxes.length === 1
      ? { id: 'screen', x: 0, y: 0, w: document.device.width, h: document.device.height }
      : unionBox(boxes)
  patchDocument((project) => {
    const screen = project.screens.find((item) => item.id === selected.screenId)
    if (!screen) return
    for (const box of boxes) {
      const node = screen.children.find((item) => item.id === box.id)
      if (!node) continue
      moveNodeBox(node, box, alignedPosition(box, frame, key))
    }
  })
}

export function distributeSelection(axis: 'x' | 'y'): void {
  const selected = selectedUnlocked()
  if (!selected || selected.nodes.length < 3) return
  const next = distributedPositions(boxesOf(selected.nodes), axis)
  patchDocument((project) => {
    const screen = project.screens.find((item) => item.id === selected.screenId)
    if (!screen) return
    for (const box of boxesOf(selected.nodes)) {
      const node = screen.children.find((item) => item.id === box.id)
      const target = next.find((item) => item.id === box.id)
      if (!node || !target) continue
      moveNodeBox(node, box, target)
    }
  })
}

export function flipSelection(axis: 'x' | 'y'): void {
  const selected = selectedUnlocked()
  if (!selected) return
  const boxes = boxesOf(selected.nodes)
  const frame = boxes.length === 1 ? boxes[0] : unionBox(boxes)
  if (!frame) return
  patchDocument((project) => {
    const screen = project.screens.find((item) => item.id === selected.screenId)
    if (!screen) return
    for (const box of boxes) {
      const node = screen.children.find((item) => item.id === box.id)
      if (!node) continue
      moveNodeBox(node, box, flippedOrigin(box, frame, axis))
      if (axis === 'x') node.flipX = !node.flipX
      else node.flipY = !node.flipY
    }
  })
}

export function addNode(screenId: string, node: SceneNode): void {
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === screenId)
    if (screen) screen.children.push(node)
  })
  setSelectedIds([node.id])
}

export function placeImageOnActiveScreen(
  name: string,
  asset: string,
  size = 16,
  origin?: { x: number; y: number },
  extra?: Pick<SceneNode, 'frames' | 'fps'>
): void {
  const { document, activeScreenId, galleryAnchor } = useAppStore.getState()
  const screen = document?.screens.find((item) => item.id === activeScreenId) ?? document?.screens[0]
  if (!document || !screen) return
  const w = Math.min(size, document.device.width)
  const h = Math.min(size, document.device.height)
  const point = origin ?? galleryAnchor
  const shift = screen.children.filter((node) => node.type === 'image').length * 4
  const clamp = (value: number, span: number, limit: number) => Math.max(0, Math.min(limit - span, Math.round(value)))
  const x = point
    ? clamp(point.x - w / 2, w, document.device.width)
    : clamp((document.device.width - w) / 2 + shift, w, document.device.width)
  const y = point
    ? clamp(point.y - h / 2, h, document.device.height)
    : clamp((document.device.height - h) / 2 + shift, h, document.device.height)
  addNode(screen.id, createNode('image', name, { x, y, w, h }, { asset, fill: false, ...extra }))
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
  let strokeColor: SceneNode['color'] = extra?.strokeColor ?? color
  if (isColorDisplay(mode) && (strokeColor === 1 || strokeColor === '1')) strokeColor = '#FFFFFF'
  const node: SceneNode = {
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
    color,
    strokeColor
  }
  if (type === 'text') {
    node.font = node.font || defaultBitmapFont(useAppStore.getState().document?.device.library)
    if (!node.text) node.text = name
    fitTextNode(node)
  }
  return node
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
