import { fillRgb, strokeRgb } from '@/core/color/rgb565'
import { paintPoints } from '@/core/document/paint'
import type { SceneNode } from '@/core/document/model'
import { drawBitmapText } from '@/core/fonts/bitmap-font'
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
    drawBitmapText(buffer, x, y, node.text || node.name, node.font, fillInk)
    return
  }

  const radius = node.type === 'rect' ? (node.radius ?? 0) : 0
  if (radius > 0) {
    if (fill && fillInk !== null) buffer.fillRoundRect(x, y, w, h, radius, fillInk)
    if (stroke && strokeInk !== null) buffer.strokeRoundRect(x, y, w, h, radius, node.stroke || 1, strokeInk)
    return
  }
  if (fill && fillInk !== null) buffer.fillRect(x, y, w, h, fillInk)
  if (stroke && strokeInk !== null) buffer.strokeRect(x, y, w, h, node.stroke || 1, strokeInk)
}

export function rgbaToMono(bytes: Uint8ClampedArray, width: number, height: number): MonoBitmap {
  const count = width * height
  const data = new Uint8Array(count)
  const kind = new Uint8Array(count)
  let dark = 0
  let light = 0
  let other = 0
  for (let i = 0; i < count; i += 1) {
    const a = bytes[i * 4 + 3] ?? 0
    if (a <= 96) continue
    const r = bytes[i * 4] ?? 0
    const g = bytes[i * 4 + 1] ?? 0
    const b = bytes[i * 4 + 2] ?? 0
    const lum = (r + g + b) / 3
    if (lum < 40) {
      kind[i] = 1
      dark += 1
    } else if (lum > 220) {
      kind[i] = 2
      light += 1
    } else {
      kind[i] = 3
      other += 1
    }
  }
  const backdrop = count * 0.45
  const dropDark = dark > backdrop && light + other > 0
  const dropLight = light > backdrop && dark + other > 0
  for (let i = 0; i < count; i += 1) {
    const pixel = kind[i] ?? 0
    if (pixel === 0) continue
    if (dropDark && pixel === 1) continue
    if (dropLight && pixel === 2) continue
    data[i] = 1
  }
  return { width, height, data }
}
