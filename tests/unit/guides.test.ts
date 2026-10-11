import { describe, expect, it } from 'vitest'
import { alignmentGuides, screenBox, snapBox, snapPoint } from '@/core/document/guides'

const frame = screenBox(128, 64)

describe('guides', () => {
  it('snaps a box to the screen center', () => {
    const next = snapBox({ id: 'a', x: 52, y: 25, w: 20, h: 10 }, frame, [], 3)
    expect(next.x).toBe(54)
    expect(next.y).toBe(27)
    expect(next.guides.some((line) => line.axis === 'x' && line.at === 64)).toBe(true)
    expect(next.guides.some((line) => line.axis === 'y' && line.at === 32)).toBe(true)
  })

  it('snaps a point to another layer edge', () => {
    const other = { id: 'b', x: 10, y: 8, w: 16, h: 8 }
    const next = snapPoint({ x: 26, y: 20 }, frame, [other], 2)
    expect(next.x).toBe(26)
    expect(next.guides.some((line) => line.axis === 'x' && line.at === 26)).toBe(true)
  })

  it('does not snap when the gap is larger than the threshold', () => {
    const next = snapBox({ id: 'a', x: 4, y: 4, w: 10, h: 8 }, frame, [], 2)
    expect(next.x).toBe(4)
    expect(next.y).toBe(4)
    expect(next.guides).toEqual([])
  })

  it('reports alignment guides for a centered box', () => {
    const guides = alignmentGuides({ id: 'a', x: 54, y: 27, w: 20, h: 10 }, frame, [], 0)
    expect(guides).toHaveLength(2)
  })
})
