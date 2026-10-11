import type { SceneNode } from '@/core/document/model'
import { nodeBounds } from '@/core/render/raster-node'

export type AlignKey = 'startX' | 'centerX' | 'endX' | 'startY' | 'centerY' | 'endY'

export interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export function boxesOf(nodes: SceneNode[]): Box[] {
  return nodes.map((node) => ({ id: node.id, ...nodeBounds(node) }))
}

export function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((item) => item.x))
  const y = Math.min(...boxes.map((item) => item.y))
  const right = Math.max(...boxes.map((item) => item.x + item.w))
  const bottom = Math.max(...boxes.map((item) => item.y + item.h))
  return { id: 'frame', x, y, w: right - x, h: bottom - y }
}

export function alignedPosition(box: Box, frame: Box, key: AlignKey): { x: number; y: number } {
  let x = box.x
  let y = box.y
  if (key === 'startX') x = frame.x
  if (key === 'centerX') x = Math.round(frame.x + (frame.w - box.w) / 2)
  if (key === 'endX') x = frame.x + frame.w - box.w
  if (key === 'startY') y = frame.y
  if (key === 'centerY') y = Math.round(frame.y + (frame.h - box.h) / 2)
  if (key === 'endY') y = frame.y + frame.h - box.h
  return { x, y }
}

export function distributedPositions(boxes: Box[], axis: 'x' | 'y'): { id: string; x: number; y: number }[] {
  if (boxes.length < 3) return boxes.map((item) => ({ id: item.id, x: item.x, y: item.y }))
  const sorted = [...boxes].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (!first || !last) return boxes.map((item) => ({ id: item.id, x: item.x, y: item.y }))
  const size = axis === 'x' ? (item: Box) => item.w : (item: Box) => item.h
  const start = axis === 'x' ? first.x : first.y
  const end = axis === 'x' ? last.x + last.w : last.y + last.h
  const total = sorted.reduce((sum, item) => sum + size(item), 0)
  const gap = (end - start - total) / (sorted.length - 1)
  let cursor = start
  return sorted.map((item) => {
    const next = axis === 'x' ? { id: item.id, x: Math.round(cursor), y: item.y } : { id: item.id, x: item.x, y: Math.round(cursor) }
    cursor += size(item) + gap
    return next
  })
}

export function flippedOrigin(box: Box, frame: Box, axis: 'x' | 'y'): { x: number; y: number } {
  if (axis === 'x') {
    const cx = frame.x + frame.w / 2
    return { x: Math.round(2 * cx - box.x - box.w), y: box.y }
  }
  const cy = frame.y + frame.h / 2
  return { x: box.x, y: Math.round(2 * cy - box.y - box.h) }
}
