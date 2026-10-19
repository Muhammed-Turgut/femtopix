import type { SceneNode, Screen } from '@/core/document/model'
import { currentScreen, useAppStore } from '@/store/app-store'
import { duplicateScreen, pasteScreenClone, patchDocument, removeNodes, removeScreen, setSelectedIds } from '@/ui/editor/document-actions'

let layerClipboard: SceneNode[] = []
let screenClipboard: Screen | null = null

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function hasTextSelection(): boolean {
  const text = window.getSelection()?.toString()
  return Boolean(text && text.length > 0)
}

function newNodeId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function copySelection(): boolean {
  const { document, selectedIds, activeScreenId } = useAppStore.getState()
  const screen = currentScreen(document, activeScreenId)
  if (!screen || selectedIds.length === 0) return false
  layerClipboard = screen.children.filter((node) => selectedIds.includes(node.id)).map((node) => structuredClone(node))
  screenClipboard = null
  return layerClipboard.length > 0
}

export function copyActiveScreen(): boolean {
  const { document, activeScreenId } = useAppStore.getState()
  const screen = currentScreen(document, activeScreenId)
  if (!screen) return false
  screenClipboard = structuredClone(screen)
  layerClipboard = []
  return true
}

export function duplicateSelection(): void {
  if (copySelection()) {
    pasteClipboard()
    return
  }
  const id = useAppStore.getState().activeScreenId
  if (id) duplicateScreen(id)
}

export function cutSelection(): void {
  const screenId = useAppStore.getState().activeScreenId
  const ids = useAppStore.getState().selectedIds
  if (!copySelection() || !screenId) return
  removeNodes(screenId, ids)
}

export function pasteClipboard(): void {
  const { activeScreenId } = useAppStore.getState()
  if (layerClipboard.length === 0) {
    if (screenClipboard) pasteScreenClone(screenClipboard)
    return
  }
  if (!activeScreenId) return
  const nodes = layerClipboard.map((node) => ({
    ...structuredClone(node),
    id: newNodeId(),
    x: node.x + 4,
    y: node.y + 4
  }))
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === activeScreenId)
    if (screen) screen.children.push(...nodes)
  })
  setSelectedIds(nodes.map((node) => node.id))
  layerClipboard = nodes.map((node) => structuredClone(node))
}

export function selectAllLayers(): void {
  const { document, activeScreenId } = useAppStore.getState()
  const screen = currentScreen(document, activeScreenId)
  if (!screen) return
  setSelectedIds(screen.children.map((node) => node.id))
}

export function nudgeSelection(dx: number, dy: number): void {
  const { activeScreenId, selectedIds } = useAppStore.getState()
  if (!activeScreenId || selectedIds.length === 0) return
  patchDocument((document) => {
    const screen = document.screens.find((item) => item.id === activeScreenId)
    if (!screen) return
    for (const node of screen.children) {
      if (!selectedIds.includes(node.id) || node.locked) continue
      node.x += dx
      node.y += dy
    }
  })
}

let lastHistoryEdit = 0

function undoDocument(): void {
  const now = Date.now()
  if (now - lastHistoryEdit < 40) return
  lastHistoryEdit = now
  useAppStore.getState().undo()
}

function redoDocument(): void {
  const now = Date.now()
  if (now - lastHistoryEdit < 40) return
  lastHistoryEdit = now
  useAppStore.getState().redo()
}

export function runEditCommand(command: 'undo' | 'redo' | 'copy' | 'cut' | 'paste' | 'selectAll'): void {
  if ((command === 'undo' || command === 'redo') && document.activeElement instanceof HTMLTextAreaElement) return
  if (command === 'undo') {
    undoDocument()
    return
  }
  if (command === 'redo') {
    redoDocument()
    return
  }
  if (isTypingTarget(document.activeElement)) {
    if (command === 'copy') document.execCommand('copy')
    if (command === 'cut') document.execCommand('cut')
    if (command === 'paste') document.execCommand('paste')
    if (command === 'selectAll') document.execCommand('selectAll')
    return
  }
  if (command === 'copy' && hasTextSelection()) return
  if (command === 'copy') {
    if (!copySelection()) copyActiveScreen()
  }
  if (command === 'cut') {
    if (useAppStore.getState().selectedIds.length) cutSelection()
    else {
      const id = useAppStore.getState().activeScreenId
      if (copyActiveScreen() && id) removeScreen(id)
    }
  }
  if (command === 'paste') pasteClipboard()
  if (command === 'selectAll') selectAllLayers()
}

export function handleEditKey(event: KeyboardEvent): boolean {
  const mod = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (mod && (key === 'z' || key === 'y')) {
    if (event.target instanceof HTMLTextAreaElement) return false
    event.preventDefault()
    if (key === 'y' || event.shiftKey) redoDocument()
    else undoDocument()
    return true
  }
  if (isTypingTarget(event.target)) return false
  if (mod && key === 'c') {
    if (hasTextSelection()) return false
    event.preventDefault()
    if (!copySelection()) copyActiveScreen()
    return true
  }
  if (mod && key === 'x') {
    if (hasTextSelection()) return false
    event.preventDefault()
    if (useAppStore.getState().selectedIds.length) cutSelection()
    else {
      const id = useAppStore.getState().activeScreenId
      if (copyActiveScreen() && id) removeScreen(id)
    }
    return true
  }
  if (mod && key === 'v') {
    event.preventDefault()
    pasteClipboard()
    return true
  }
  if (mod && key === 'd') {
    event.preventDefault()
    duplicateSelection()
    return true
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const { activeScreenId, selectedIds, document } = useAppStore.getState()
    if (selectedIds.length && activeScreenId) {
      event.preventDefault()
      removeNodes(activeScreenId, selectedIds)
      return true
    }
    if (activeScreenId && (document?.screens.length ?? 0) > 1) {
      event.preventDefault()
      removeScreen(activeScreenId)
      return true
    }
    return false
  }
  if (mod && key === 'a') {
    event.preventDefault()
    selectAllLayers()
    return true
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const step = event.shiftKey ? 10 : 1
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
    if (useAppStore.getState().selectedIds.length === 0) return false
    event.preventDefault()
    nudgeSelection(dx, dy)
    return true
  }
  return false
}
