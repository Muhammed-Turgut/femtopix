import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { SceneNode } from '@/core/document/model'
import { textBounds } from '@/core/fonts/bitmap-font'

export function LayerPreview({
  node,
  zoom,
  selected,
  onPointerDown
}: {
  node: SceneNode
  zoom: number
  pixelOn?: string
  selected?: boolean
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  if (!node.visible) return null

  const bounds = node.type === 'text' ? textBounds(node) : null
  const x = bounds?.x ?? Math.min(node.x, node.x + (node.w ?? 0))
  const y = bounds?.y ?? Math.min(node.y, node.y + (node.h ?? 0))
  const w = bounds?.w ?? Math.max(1, Math.abs(node.w ?? 1))
  const h = bounds?.h ?? Math.max(1, Math.abs(node.h ?? 1))
  const box: CSSProperties = {
    position: 'absolute',
    left: Math.round(x) * zoom,
    top: Math.round(y) * zoom,
    width: Math.round(w) * zoom,
    height: Math.round(h) * zoom,
    outline: selected ? '1px solid var(--accent)' : undefined,
    outlineOffset: 0,
    pointerEvents: node.locked ? 'none' : 'auto'
  }

  return <div data-node-id={node.id} style={box} onPointerDown={onPointerDown} />
}
