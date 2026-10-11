import { describe, expect, it } from 'vitest'
import { gridStep } from '@/core/render/pixel-grid'

describe('pixel grid lod', () => {
  it('uses large cells when zoomed out', () => {
    expect(gridStep(1)).toBe(16)
    expect(gridStep(2)).toBe(8)
  })

  it('reaches one cell per device pixel at max zoom', () => {
    expect(gridStep(64)).toBe(1)
    expect(gridStep(16)).toBe(1)
  })
})
