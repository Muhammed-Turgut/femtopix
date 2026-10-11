import { describe, expect, it } from 'vitest'
import { rgbaToMono } from '@/core/render/draw-node'

function rgba(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const bytes = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y)
      const i = (y * width + x) * 4
      bytes[i] = r
      bytes[i + 1] = g
      bytes[i + 2] = b
      bytes[i + 3] = a
    }
  }
  return bytes
}

function onCount(bytes: Uint8ClampedArray, width: number, height: number): number {
  return rgbaToMono(bytes, width, height).data.reduce((sum, value) => sum + value, 0)
}

describe('rgbaToMono', () => {
  it('keeps sparse black pixels on a transparent frame', () => {
    const bytes = rgba(16, 16, (x, y) => (x === 2 && y === 2 ? [0, 0, 0, 255] : [0, 0, 0, 0]))
    expect(onCount(bytes, 16, 16)).toBe(1)
  })

  it('keeps a sparse white icon', () => {
    const bytes = rgba(16, 16, (x, y) => (x < 3 && y < 3 ? [255, 255, 255, 255] : [0, 0, 0, 0]))
    expect(onCount(bytes, 16, 16)).toBe(9)
  })

  it('drops a white backdrop and keeps the colored glyph', () => {
    const bytes = rgba(16, 16, (x, y) => (x < 4 && y < 2 ? [80, 240, 120, 255] : [255, 255, 255, 255]))
    expect(onCount(bytes, 16, 16)).toBe(8)
  })

  it('drops a black backdrop and keeps the colored glyph', () => {
    const bytes = rgba(16, 16, (x, y) => (x > 4 && x < 12 && y > 4 && y < 12 ? [255, 0, 0, 255] : [0, 0, 0, 255]))
    expect(onCount(bytes, 16, 16)).toBe(49)
  })

  it('keeps a solid black frame as ink', () => {
    const bytes = rgba(4, 4, () => [0, 0, 0, 255])
    expect(onCount(bytes, 4, 4)).toBe(16)
  })
})
