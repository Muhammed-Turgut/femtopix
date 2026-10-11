import type { Box } from '@/core/document/arrange'

export interface GuideLine {
  axis: 'x' | 'y'
  at: number
  start: number
  end: number
}

export interface SnapResult {
  x: number
  y: number
  guides: GuideLine[]
}

interface Target {
  at: number
  start: number
  end: number
  screen: boolean
}

export function snapThreshold(zoom: number): number {
  return Math.max(2, Math.round(8 / Math.max(1, zoom)))
}

export function screenBox(width: number, height: number): Box {
  return { id: 'screen', x: 0, y: 0, w: width, h: height }
}

function uniqueTargets(items: Target[]): Target[] {
  const seen = new Set<string>()
  const next: Target[] = []
  for (const item of items) {
    const key = `${item.at}:${item.screen ? 's' : 'o'}:${item.start}:${item.end}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(item)
  }
  return next
}

function axisTargets(frame: Box, others: Box[], axis: 'x' | 'y'): Target[] {
  const along = axis === 'x'
  const start = along ? frame.y : frame.x
  const end = along ? frame.y + frame.h : frame.x + frame.w
  const size = along ? frame.w : frame.h
  const origin = along ? frame.x : frame.y
  const screenSpan = { start, end, screen: true }
  const targets: Target[] = [
    { at: origin, ...screenSpan },
    { at: Math.round(origin + size / 2), ...screenSpan },
    { at: origin + size, ...screenSpan }
  ]
  for (const box of others) {
    const boxStart = along ? box.y : box.x
    const boxEnd = along ? box.y + box.h : box.x + box.w
    const boxOrigin = along ? box.x : box.y
    const boxSize = along ? box.w : box.h
    const span = { start: boxStart, end: boxEnd, screen: false }
    targets.push({ at: boxOrigin, ...span }, { at: Math.round(boxOrigin + boxSize / 2), ...span }, { at: boxOrigin + boxSize, ...span })
  }
  return uniqueTargets(targets)
}

function nearest(value: number, targets: Target[], threshold: number): Target | null {
  let best: Target | null = null
  let bestDelta = threshold
  for (const target of targets) {
    const delta = Math.abs(target.at - value)
    if (delta <= bestDelta) {
      best = target
      bestDelta = delta
    }
  }
  return best
}

function guideFrom(axis: 'x' | 'y', target: Target, boxStart: number, boxEnd: number): GuideLine {
  const start = target.screen ? target.start : Math.min(target.start, boxStart)
  const end = target.screen ? target.end : Math.max(target.end, boxEnd)
  return { axis, at: target.at, start, end }
}

export function snapPoint(
  point: { x: number; y: number },
  frame: Box,
  others: Box[],
  threshold: number
): SnapResult {
  const xHit = nearest(point.x, axisTargets(frame, others, 'x'), threshold)
  const yHit = nearest(point.y, axisTargets(frame, others, 'y'), threshold)
  const x = xHit ? xHit.at : point.x
  const y = yHit ? yHit.at : point.y
  const guides: GuideLine[] = []
  if (xHit) guides.push(guideFrom('x', xHit, y, y + 1))
  if (yHit) guides.push(guideFrom('y', yHit, x, x + 1))
  return { x, y, guides }
}

export function snapBox(box: Box, frame: Box, others: Box[], threshold: number): SnapResult {
  const xs = [box.x, Math.round(box.x + box.w / 2), box.x + box.w]
  const ys = [box.y, Math.round(box.y + box.h / 2), box.y + box.h]
  let dx = 0
  let dy = 0
  let xHit: Target | null = null
  let yHit: Target | null = null
  let xDelta = threshold + 1
  let yDelta = threshold + 1
  for (const value of xs) {
    const hit = nearest(value, axisTargets(frame, others, 'x'), threshold)
    if (!hit) continue
    const delta = hit.at - value
    if (Math.abs(delta) < xDelta) {
      xHit = hit
      dx = delta
      xDelta = Math.abs(delta)
    }
  }
  for (const value of ys) {
    const hit = nearest(value, axisTargets(frame, others, 'y'), threshold)
    if (!hit) continue
    const delta = hit.at - value
    if (Math.abs(delta) < yDelta) {
      yHit = hit
      dy = delta
      yDelta = Math.abs(delta)
    }
  }
  const x = box.x + dx
  const y = box.y + dy
  const guides: GuideLine[] = []
  if (xHit) guides.push(guideFrom('x', xHit, y, y + box.h))
  if (yHit) guides.push(guideFrom('y', yHit, x, x + box.w))
  return { x, y, guides }
}

export function alignmentGuides(box: Box, frame: Box, others: Box[], threshold = 1): GuideLine[] {
  return snapBox(box, frame, others, threshold).guides
}

export function centerGuides(frame: Box): GuideLine[] {
  return [
    { axis: 'x', at: Math.round(frame.x + frame.w / 2), start: frame.y, end: frame.y + frame.h },
    { axis: 'y', at: Math.round(frame.y + frame.h / 2), start: frame.x, end: frame.x + frame.w }
  ]
}
