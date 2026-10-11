import { fillRgb, strokeRgb } from '@/core/color/rgb565'
import { paintPoints } from '@/core/document/paint'
import type { SceneNode } from '@/core/document/model'
import { PixelBuffer } from '@/core/render/pixel-buffer'

export type MonoBitmap = { width: number; height: number; data: Uint8Array }

function box(node: SceneNode) {
  const w = Math.max(1, Math.round(Math.abs(node.w ?? 1)))
  const h = Math.max(1, Math.round(Math.abs(node.h ?? 1)))
  const x = Math.round(Math.min(node.x, node.x + (node.w ?? 0)))
  const y = Math.round(Math.min(node.y, node.y + (node.h ?? 0)))
  return { x, y, w, h }
}

function trianglePoints(node: SceneNode): { x: number; y: number }[] {
  const { x, y, w, h } = box(node)
  return [
    { x: x + Math.floor(w / 2), y },
    { x: x + w - 1, y: y + h - 1 },
    { x, y: y + h - 1 }
  ]
}

function pentagonPoints(node: SceneNode): { x: number; y: number }[] {
  const { x, y, w, h } = box(node)
  return [0, 1, 2, 3, 4].map((index) => {
    const angle = ((index * 72 - 90) * Math.PI) / 180
    return {
      x: Math.round(x + w / 2 + (w / 2) * Math.cos(angle)),
      y: Math.round(y + h / 2 + (h / 2) * Math.sin(angle))
    }
  })
}

function withFlip(points: { x: number; y: number }[], node: SceneNode): { x: number; y: number }[] {
  if (!node.flipX && !node.flipY) return points
  const bounds = box(node)
  return points.map((point) => ({
    x: node.flipX ? bounds.x + bounds.w - 1 - (point.x - bounds.x) : point.x,
    y: node.flipY ? bounds.y + bounds.h - 1 - (point.y - bounds.y) : point.y
  }))
}

export function drawNode(buffer: PixelBuffer, node: SceneNode, bitmaps: Map<string, MonoBitmap>): void {
  if (!node.visible || node.role === 'reference') return
  const fillInk = fillRgb(node)
  const strokeInk = strokeRgb(node)
  const fill = node.fill !== false && fillInk !== null
  const stroke = ((node.stroke ?? 0) > 0 || node.fill === false) && strokeInk !== null
  const { x, y, w, h } = box(node)

  if (node.type === 'paint' && node.points?.length) {
    if (strokeInk === null) return
    for (const point of paintPoints(node)) buffer.set(point.x, point.y, strokeInk)
    return
  }
  if (node.type === 'line' || node.type === 'polyline' || node.type === 'paint') {
    if (strokeInk === null) return
    const x0 = node.flipX ? node.x + (node.w ?? 0) : node.x
    const y0 = node.flipY ? node.y + (node.h ?? 0) : node.y
    const x1 = node.flipX ? node.x : node.x + (node.w ?? 0)
    const y1 = node.flipY ? node.y : node.y + (node.h ?? 0)
    buffer.line(x0, y0, x1, y1, strokeInk)
    return
  }
  if (node.type === 'ellipse') {
    if (fill && fillInk !== null) buffer.ellipse(x, y, w, h, true, fillInk)
    if (stroke && strokeInk !== null) buffer.ellipse(x, y, w, h, false, strokeInk)
    return
  }
  if (node.type === 'triangle') {
    buffer.polygon(withFlip(trianglePoints(node), node), fill, fillInk ?? 0, stroke, strokeInk ?? 0)
    return
  }
  if (node.type === 'polygon') {
    buffer.polygon(withFlip(pentagonPoints(node), node), fill, fillInk ?? 0, stroke, strokeInk ?? 0)
    return
  }
  if (node.type === 'image' && node.asset) {
    if (fillInk === null) return
    const key = `${node.asset}:${w}x${h}`
    const bitmap = bitmaps.get(key)
    if (bitmap) buffer.blit(bitmap.data, bitmap.width, bitmap.height, x, y, w, h, fillInk, Boolean(node.flipX), Boolean(node.flipY))
    return
  }
  if (node.type === 'text') {
    if (fillInk === null) return
    const key = `text:${node.text || node.name}:${w}x${h}:${node.font ?? ''}`
    const bitmap = bitmaps.get(key)
    if (bitmap) buffer.blit(bitmap.data, bitmap.width, bitmap.height, x, y, w, h, fillInk, Boolean(node.flipX), Boolean(node.flipY))
    return
  }

  if (fill && fillInk !== null) buffer.fillRect(x, y, w, h, fillInk)
  if (stroke && strokeInk !== null) buffer.strokeRect(x, y, w, h, node.stroke || 1, strokeInk)
}

export function rgbaToMono(bytes: Uint8ClampedArray, width: number, height: number): MonoBitmap {
  const data = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    const a = bytes[i * 4 + 3] ?? 0
    const r = bytes[i * 4] ?? 0
    const g = bytes[i * 4 + 1] ?? 0
    const b = bytes[i * 4 + 2] ?? 0
    data[i] = a > 96 && (r + g + b) / 3 < 220 ? 1 : 0
  }
  return { width, height, data }
}
