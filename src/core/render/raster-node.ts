import type { SceneNode } from '@/core/document/model'
import { textBounds } from '@/core/fonts/bitmap-font'
import { drawNode, type MonoBitmap } from '@/core/render/draw-node'
import { PixelBuffer } from '@/core/render/pixel-buffer'

export function nodeBounds(node: SceneNode): { x: number; y: number; w: number; h: number } {
  if (node.type === 'text') return textBounds(node)
  const w = Math.max(1, Math.round(Math.abs(node.w ?? 1)))
  const h = Math.max(1, Math.round(Math.abs(node.h ?? 1)))
  const x = Math.round(Math.min(node.x, node.x + (node.w ?? 0)))
  const y = Math.round(Math.min(node.y, node.y + (node.h ?? 0)))
  return { x, y, w, h }
}

export function rasterizeNode(node: SceneNode, bitmaps = new Map<string, MonoBitmap>()): PixelBuffer {
  const { x, y, w, h } = nodeBounds(node)
  const buffer = new PixelBuffer(w, h)
  const local: SceneNode = { ...node, x: node.x - x, y: node.y - y }
  drawNode(buffer, local, bitmaps)
  return buffer
}
