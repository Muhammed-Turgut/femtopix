import { describe, expect, it } from 'vitest'
import type { SceneNode } from '@/core/document/model'
import { formatAnimationHeader, formatXbmHeader, packXbm } from '@/core/export/xbm'
import { rasterizeNode } from '@/core/render/raster-node'
import { PixelBuffer } from '@/core/render/pixel-buffer'

function at(buffer: PixelBuffer, x: number, y: number): number {
  return buffer.data[y * buffer.width + x] ?? 0
}

describe('pixel buffer', () => {
  it('fills and strokes on the integer grid', () => {
    const buffer = new PixelBuffer(8, 8)
    buffer.fillRect(1, 1, 3, 2)
    expect(at(buffer, 1, 1)).toBe(0xffffffff)
    expect(at(buffer, 3, 2)).toBe(0xffffffff)
    expect(at(buffer, 4, 1)).toBe(0)

    const frame = new PixelBuffer(6, 6)
    frame.strokeRect(1, 1, 4, 4, 1)
    expect(at(frame, 1, 1)).toBe(0xffffffff)
    expect(at(frame, 2, 2)).toBe(0)
    expect(at(frame, 4, 4)).toBe(0xffffffff)
  })

  it('rounds rect corners and leaves the outer pixels empty', () => {
    const buffer = new PixelBuffer(8, 8)
    buffer.fillRoundRect(0, 0, 8, 8, 2)
    expect(at(buffer, 0, 0)).toBe(0)
    expect(at(buffer, 7, 0)).toBe(0)
    expect(at(buffer, 0, 7)).toBe(0)
    expect(at(buffer, 7, 7)).toBe(0)
    expect(at(buffer, 3, 3)).toBe(0xffffffff)
    expect(at(buffer, 2, 0)).toBe(0xffffffff)
  })

  it('draws a Bresenham line without anti-alias', () => {
    const buffer = new PixelBuffer(5, 5)
    buffer.line(0, 0, 4, 0)
    expect([0, 1, 2, 3, 4].every((x) => at(buffer, x, 0) === 0xffffffff)).toBe(true)
    expect(at(buffer, 0, 1)).toBe(0)
  })
})

describe('xbm header', () => {
  it('packs LSB-first XBM bytes', () => {
    const pixels = Uint8Array.from([1, 0, 1, 0, 1, 0, 1, 0])
    expect([...packXbm(pixels, 8, 1)]).toEqual([0x55])
  })

  it('emits a PROGMEM header for a stroked rect', () => {
    const node: SceneNode = {
      id: 'n1',
      type: 'rect',
      name: 'Dikdörtgen',
      x: 8,
      y: 6,
      w: 8,
      h: 4,
      visible: true,
      locked: false,
      color: 1,
      fill: false,
      stroke: 1
    }
    const buffer = rasterizeNode(node)
    expect(buffer.width).toBe(8)
    expect(buffer.height).toBe(4)
    expect(at(buffer, 0, 0)).toBe(0xffffffff)
    expect(at(buffer, 1, 1)).toBe(0)
    const header = formatXbmHeader({
      ident: 'dikdortgen',
      name: node.name,
      width: buffer.width,
      height: buffer.height,
      bits: packXbm(buffer.data, buffer.width, buffer.height)
    })
    expect(header).toContain('#ifndef IMAGE_DIKDORTGEN_BITS_H')
    expect(header).toContain('#include <Arduino.h>')
    expect(header).toContain('#define dikdortgen_width 8')
    expect(header).toContain('#define dikdortgen_height 4')
    expect(header).toContain('static const unsigned char PROGMEM dikdortgen_bits[]')
    expect(header.trimEnd().endsWith('#endif')).toBe(true)
  })

  it('emits one bitmap per animation frame', () => {
    const header = formatAnimationHeader({
      ident: 'kalp',
      name: 'Kalp',
      width: 8,
      height: 1,
      fps: 8,
      frames: [Uint8Array.from([0x01]), Uint8Array.from([0x80])]
    })
    expect(header).toContain('#define kalp_frame_count 2')
    expect(header).toContain('#define kalp_fps 8')
    expect(header).toContain('#include <Arduino.h>')
    expect(header).toContain('static const unsigned char PROGMEM kalp_0_bits[]')
    expect(header).toContain('static const unsigned char PROGMEM kalp_1_bits[]')
    expect(header).toContain('PROGMEM kalp_frames[] = { kalp_0_bits, kalp_1_bits }')
  })
})

describe('rgb565', () => {
  it('packs and expands 16-bit colors', async () => {
    const { expandRgb565, hexToRgb565, rgb565Literal, snapHexToRgb565 } = await import('@/core/color/rgb565')
    expect(hexToRgb565('#FF0000')).toBe(0xf800)
    expect(hexToRgb565('#00FF00')).toBe(0x07e0)
    expect(hexToRgb565('#0000FF')).toBe(0x001f)
    expect(expandRgb565(0xf800).toLowerCase()).toBe('#ff0000')
    expect(rgb565Literal('#FF0000')).toBe('0xf800')
    expect(snapHexToRgb565('#ff0000').toLowerCase()).toBe('#ff0000')
  })

  it('tints a rasterized rect with the node color', async () => {
    const { rasterizeNode } = await import('@/core/render/raster-node')
    const node: SceneNode = {
      id: 'n2',
      type: 'rect',
      name: 'red',
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      visible: true,
      locked: false,
      color: '#F80000',
      fill: true,
      stroke: 0
    }
    const buffer = rasterizeNode(node)
    expect(at(buffer, 0, 0)).toBe(0xfff80000)
    expect(at(buffer, 2, 1)).toBe(0xfff80000)
  })

  it('paints fill and stroke with different colors', async () => {
    const { rasterizeNode } = await import('@/core/render/raster-node')
    const node: SceneNode = {
      id: 'n3',
      type: 'rect',
      name: 'frame',
      x: 0,
      y: 0,
      w: 5,
      h: 4,
      visible: true,
      locked: false,
      color: '#F80000',
      strokeColor: '#0000F8',
      fill: true,
      stroke: 1
    }
    const buffer = rasterizeNode(node)
    expect(at(buffer, 2, 1)).toBe(0xfff80000)
    expect(at(buffer, 0, 0)).toBe(0xff0000f8)
    expect(at(buffer, 4, 3)).toBe(0xff0000f8)
  })

  it('paints discrete pixels for a paint stroke', async () => {
    const { rasterizeNode } = await import('@/core/render/raster-node')
    const node: SceneNode = {
      id: 'n4',
      type: 'paint',
      name: 'dots',
      x: 1,
      y: 1,
      w: 3,
      h: 2,
      visible: true,
      locked: false,
      color: 1,
      fill: false,
      stroke: 1,
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 }
      ]
    }
    const buffer = rasterizeNode(node)
    expect(at(buffer, 0, 0)).toBe(0xffffffff)
    expect(at(buffer, 2, 1)).toBe(0xffffffff)
    expect(at(buffer, 1, 0)).toBe(0)
  })
})

describe('arrange', () => {
  it('aligns a box to the right of the frame', async () => {
    const { alignedPosition } = await import('@/core/document/arrange')
    const next = alignedPosition({ id: 'a', x: 4, y: 2, w: 8, h: 4 }, { id: 'f', x: 0, y: 0, w: 32, h: 16 }, 'endX')
    expect(next).toEqual({ x: 24, y: 2 })
  })

  it('mirrors a box around the frame center', async () => {
    const { flippedOrigin } = await import('@/core/document/arrange')
    const next = flippedOrigin({ id: 'a', x: 2, y: 4, w: 6, h: 4 }, { id: 'f', x: 0, y: 0, w: 20, h: 16 }, 'x')
    expect(next).toEqual({ x: 12, y: 4 })
  })
})
