import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { SceneNode } from '@/core/document/model'

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

  const x = Math.min(node.x, node.x + (node.w ?? 0))
  const y = Math.min(node.y, node.y + (node.h ?? 0))
  const w = Math.max(1, Math.abs(node.w ?? 1))
  const h = Math.max(1, Math.abs(node.h ?? 1))
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
