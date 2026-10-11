import { describe, expect, it } from 'vitest'
import type { SceneNode } from '@/core/document/model'
import { applyTextFont, defaultBitmapFont, drawBitmapText, fitTextNode, measureText, setTextBaselineY, textBaselineY } from '@/core/fonts/bitmap-font'
import { rasterizeNode } from '@/core/render/raster-node'
import { PixelBuffer } from '@/core/render/pixel-buffer'

function at(buffer: PixelBuffer, x: number, y: number): number {
  return buffer.data[y * buffer.width + x] ?? 0
}

describe('bitmap font', () => {
  it('sizes a string to the library cell grid', () => {
    expect(measureText('Metin', '6x10')).toEqual({ w: 30, h: 10 })
    expect(measureText('Metin', '5x7')).toEqual({ w: 30, h: 8 })
    expect(defaultBitmapFont('u8g2')).toBe('6x10')
    expect(defaultBitmapFont('adafruit_gfx')).toBe('5x7')
  })

  it('shrinks an oversized text box to the glyph cells', () => {
    const node: SceneNode = {
      id: 't1',
      type: 'text',
      name: 'Metin',
      x: 2,
      y: 3,
      w: 40,
      h: 10,
      visible: true,
      locked: false,
      color: 1,
      text: 'Metin',
      font: '6x10'
    }
    fitTextNode(node)
    expect(node.w).toBe(30)
    expect(node.h).toBe(10)
    expect(textBaselineY(node)).toBe(11)
    setTextBaselineY(node, 20)
    expect(node.y).toBe(12)
    applyTextFont(node, '10x20')
    expect(node.y).toBe(4)
    expect(textBaselineY(node)).toBe(20)
    expect(node.h).toBe(20)
  })

  it('draws a 5×7 GLCD glyph on the pixel grid', () => {
    const buffer = new PixelBuffer(6, 8)
    drawBitmapText(buffer, 0, 0, '!', '5x7', 0xffffff)
    expect(at(buffer, 2, 0)).toBe(0xffffffff)
    expect(at(buffer, 2, 4)).toBe(0xffffffff)
    expect(at(buffer, 2, 6)).toBe(0xffffffff)
    expect(at(buffer, 0, 0)).toBe(0)
    expect(at(buffer, 5, 0)).toBe(0)
  })

  it('makes larger font ids draw bigger glyphs', () => {
    const small = new PixelBuffer(6, 8)
    const large = new PixelBuffer(12, 16)
    drawBitmapText(small, 0, 0, 'I', '5x7', 0xffffff)
    drawBitmapText(large, 0, 0, 'I', '5x7x2', 0xffffff)
    const lit = (buffer: PixelBuffer) => [...buffer.data].filter((value) => value !== 0).length
    expect(lit(large)).toBeGreaterThan(lit(small))
    expect(measureText('A', '5x7x2')).toEqual({ w: 12, h: 16 })
    expect(measureText('A', '10x20')).toEqual({ w: 10, h: 20 })
  })

  it('rasterizes text without leftover columns', () => {
    const node: SceneNode = {
      id: 't2',
      type: 'text',
      name: 'Hi',
      x: 0,
      y: 0,
      w: 40,
      h: 10,
      visible: true,
      locked: false,
      color: 1,
      text: 'Hi',
      font: '6x10'
    }
    const buffer = rasterizeNode(node)
    expect(buffer.width).toBe(12)
    expect(buffer.height).toBe(10)
  })
})
