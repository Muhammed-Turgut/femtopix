import type { ColorMode, SceneNode } from '@/core/document/model'

export const RGB565_SWATCHES = [0x0000, 0xffff, 0xf800, 0x07e0, 0x001f, 0xffe0, 0x07ff, 0xf81f, 0xfc00, 0x7bef] as const

export function isColorDisplay(mode?: ColorMode | null): boolean {
  return mode === 'rgb565' || mode === 'rgb888'
}

export function parseCssHex(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace('#', '')
  const raw = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  const n = Number.parseInt(raw, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex(rgb: number): string {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, '0')}`
}

export function packRgb(r: number, g: number, b: number): number {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)
}

export function hexToRgb565(hex: string): number {
  const parsed = parseCssHex(hex) ?? { r: 255, g: 255, b: 255 }
  return ((parsed.r >> 3) << 11) | ((parsed.g >> 2) << 5) | (parsed.b >> 3)
}

export function expandRgb565(value: number): string {
  const r = Math.round((((value >> 11) & 31) * 255) / 31)
  const g = Math.round((((value >> 5) & 63) * 255) / 63)
  const b = Math.round(((value & 31) * 255) / 31)
  return rgbToHex(packRgb(r, g, b))
}

export function snapHexToRgb565(hex: string): string {
  return expandRgb565(hexToRgb565(hex))
}

export function rgb565Literal(color: SceneNode['color']): string {
  const rgb = inkRgb({ color } as SceneNode) ?? 0
  const r = (rgb >> 16) & 255
  const g = (rgb >> 8) & 255
  const b = rgb & 255
  const value = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
  return `0x${value.toString(16).padStart(4, '0')}`
}

export function inkRgb(node: Pick<SceneNode, 'color'>): number | null {
  const color = node.color
  if (color === 0 || color === '0') return null
  if (color === 1 || color === '1' || color === 'invert') return 0xffffff
  if (typeof color === 'string') {
    const parsed = parseCssHex(color)
    if (!parsed) return 0xffffff
    return packRgb(parsed.r, parsed.g, parsed.b)
  }
  if (typeof color === 'number' && color > 1) return color & 0xffffff
  return 0xffffff
}

export function cssHexFromColor(color: SceneNode['color']): string {
  const rgb = inkRgb({ color })
  return rgb === null ? '#000000' : rgbToHex(rgb)
}

export function pixelOn32(rgb: number): number {
  return 0xff000000 | (rgb & 0xffffff)
}
