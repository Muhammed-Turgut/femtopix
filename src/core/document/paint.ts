import type { SceneNode } from '@/core/document/model'

export function paintPoints(node: SceneNode): { x: number; y: number }[] {
  if (!node.points?.length) return []
  const w = Math.max(1, Math.round(Math.abs(node.w ?? 1)))
  const h = Math.max(1, Math.round(Math.abs(node.h ?? 1)))
  const x = Math.round(Math.min(node.x, node.x + (node.w ?? 0)))
  const y = Math.round(Math.min(node.y, node.y + (node.h ?? 0)))
  return node.points.map((point) => ({
    x: x + (node.flipX ? w - 1 - point.x : point.x),
    y: y + (node.flipY ? h - 1 - point.y : point.y)
  }))
}

export function bresenhamPixels(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] {
  let cx = Math.round(from.x)
  let cy = Math.round(from.y)
  const tx = Math.round(to.x)
  const ty = Math.round(to.y)
  const dx = Math.abs(tx - cx)
  const dy = Math.abs(ty - cy)
  const sx = cx < tx ? 1 : -1
  const sy = cy < ty ? 1 : -1
  let err = dx - dy
  const pixels: { x: number; y: number }[] = []
  while (true) {
    pixels.push({ x: cx, y: cy })
    if (cx === tx && cy === ty) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      cx += sx
    }
    if (e2 < dx) {
      err += dx
      cy += sy
    }
  }
  return pixels
}
