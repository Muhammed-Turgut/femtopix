import { isColorDisplay, rgb565Literal } from '@/core/color/rgb565'
import type { ExportTarget, IvecDocument, SceneNode, Screen } from '@/core/document/model'

interface Flags {
  wrapperFunction: boolean
  comments: boolean
  clearDisplay: boolean
  declareImages: boolean
  includeFonts: boolean
}

function flagsOf(document: IvecDocument): Flags {
  const raw = document.export.targets[document.export.activeTarget] ?? {}
  return {
    wrapperFunction: Boolean(raw.wrapperFunction ?? true),
    comments: Boolean(raw.comments ?? true),
    clearDisplay: Boolean(raw.clearDisplay ?? true),
    declareImages: Boolean(raw.declareImages ?? true),
    includeFonts: Boolean(raw.includeFonts ?? true)
  }
}

function visibleNodes(screen: Screen): SceneNode[] {
  return screen.children.filter((node) => node.visible && node.role !== 'reference')
}

function colorValue(node: SceneNode): 0 | 1 | 2 {
  if (node.color === 'invert') return 2
  if (node.color === 0 || node.color === '0') return 0
  return 1
}

function i(value: number): number {
  return Math.round(value)
}

function cString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function fontSymbol(font?: string): string {
  if (font === '7x13') return 'u8g2_font_7x13_tr'
  if (font === '8x13') return 'u8g2_font_8x13_tr'
  return 'u8g2_font_6x10_tr'
}

function trianglePoints(node: SceneNode): [number, number, number, number, number, number] {
  const w = node.w ?? 1
  const h = node.h ?? 1
  return [i(node.x + w / 2), i(node.y), i(node.x + w), i(node.y + h), i(node.x), i(node.y + h)]
}

function pentagonPoints(node: SceneNode): { x: number; y: number }[] {
  const w = node.w ?? 1
  const h = node.h ?? 1
  return [0, 1, 2, 3, 4].map((index) => {
    const angle = ((index * 72 - 90) * Math.PI) / 180
    return {
      x: i(node.x + w / 2 + (w / 2) * Math.cos(angle)),
      y: i(node.y + h / 2 + (h / 2) * Math.sin(angle))
    }
  })
}

function emitU8g2(node: SceneNode, flags: Flags): string[] {
  const lines: string[] = []
  if (flags.comments) lines.push(`  // ${node.name}`)
  lines.push(`  u8g2.setDrawColor(${colorValue(node)});`)
  const x = i(node.x)
  const y = i(node.y)
  const w = i(Math.abs(node.w ?? 1))
  const h = i(Math.abs(node.h ?? 1))
  const fill = node.fill !== false
  const stroke = (node.stroke ?? 0) > 0

  if (node.type === 'line' || node.type === 'polyline' || node.type === 'paint') {
    lines.push(`  u8g2.drawLine(${i(node.x)}, ${i(node.y)}, ${i(node.x + (node.w ?? 0))}, ${i(node.y + (node.h ?? 0))});`)
    return lines
  }
  if (node.type === 'ellipse') {
    const rx = Math.max(1, Math.round(w / 2))
    const ry = Math.max(1, Math.round(h / 2))
    const cx = x + rx
    const cy = y + ry
    if (rx === ry) {
      lines.push(fill ? `  u8g2.drawDisc(${cx}, ${cy}, ${rx});` : `  u8g2.drawCircle(${cx}, ${cy}, ${rx});`)
    } else {
      lines.push(fill ? `  u8g2.drawFilledEllipse(${cx}, ${cy}, ${rx}, ${ry}, U8G2_DRAW_ALL);` : `  u8g2.drawEllipse(${cx}, ${cy}, ${rx}, ${ry}, U8G2_DRAW_ALL);`)
    }
    return lines
  }
  if (node.type === 'triangle') {
    const [x0, y0, x1, y1, x2, y2] = trianglePoints(node)
    lines.push(`  u8g2.drawTriangle(${x0}, ${y0}, ${x1}, ${y1}, ${x2}, ${y2});`)
    return lines
  }
  if (node.type === 'polygon') {
    const pts = pentagonPoints(node)
    pts.forEach((point, index) => {
      const next = pts[(index + 1) % pts.length]
      if (next) lines.push(`  u8g2.drawLine(${point.x}, ${point.y}, ${next.x}, ${next.y});`)
    })
    return lines
  }
  if (node.type === 'text') {
    if (flags.includeFonts) lines.push(`  u8g2.setFont(${fontSymbol(node.font)});`)
    lines.push(`  u8g2.drawStr(${x}, ${y + Math.max(8, h)}, ${cString(node.text || node.name)});`)
    return lines
  }
  if (node.type === 'image') {
    const ident = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'image'
    if (flags.declareImages) {
      lines.push(`  u8g2.drawXBMP(${x}, ${y}, ${w}, ${h}, ${ident}_bits);`)
    } else if (flags.comments) {
      lines.push(`  // görsel ${node.name} ${w}x${h}`)
    }
    return lines
  }

  if (fill) lines.push(`  u8g2.drawBox(${x}, ${y}, ${w}, ${h});`)
  if (stroke || !fill) lines.push(`  u8g2.drawFrame(${x}, ${y}, ${w}, ${h});`)
  return lines
}

function isGfx(library: ExportTarget): boolean {
  return library === 'adafruit_gfx' || library === 'tft_espi' || library === 'arduino_gfx'
}

function gfxHandle(library: ExportTarget): string {
  if (library === 'tft_espi') return 'TFT_eSPI &d'
  if (library === 'arduino_gfx') return 'Arduino_GFX &d'
  return 'Adafruit_GFX &d'
}

function gfxName(library: ExportTarget): string {
  if (library === 'tft_espi') return 'TFT_eSPI'
  if (library === 'arduino_gfx') return 'Arduino_GFX'
  return 'Adafruit GFX'
}

function inkLiteral(document: IvecDocument, node: SceneNode, gfx: boolean): string {
  if (gfx && isColorDisplay(document.device.colorMode)) return rgb565Literal(node.color)
  const value = colorValue(node)
  return String(value === 2 ? 1 : value)
}

function emitGfx(node: SceneNode, flags: Flags, ink: string): string[] {
  const lines: string[] = []
  if (flags.comments) lines.push(`  // ${node.name}`)
  const x = i(node.x)
  const y = i(node.y)
  const w = i(Math.abs(node.w ?? 1))
  const h = i(Math.abs(node.h ?? 1))
  const fill = node.fill !== false
  const stroke = (node.stroke ?? 0) > 0

  if (node.type === 'line' || node.type === 'polyline' || node.type === 'paint') {
    lines.push(`  d.drawLine(${i(node.x)}, ${i(node.y)}, ${i(node.x + (node.w ?? 0))}, ${i(node.y + (node.h ?? 0))}, ${ink});`)
    return lines
  }
  if (node.type === 'ellipse') {
    const rx = Math.max(1, Math.round(w / 2))
    const ry = Math.max(1, Math.round(h / 2))
    const cx = x + rx
    const cy = y + ry
    if (rx === ry) {
      lines.push(fill ? `  d.fillCircle(${cx}, ${cy}, ${rx}, ${ink});` : `  d.drawCircle(${cx}, ${cy}, ${rx}, ${ink});`)
    } else {
      lines.push(fill ? `  d.fillEllipse(${cx}, ${cy}, ${rx}, ${ry}, ${ink});` : `  d.drawEllipse(${cx}, ${cy}, ${rx}, ${ry}, ${ink});`)
    }
    return lines
  }
  if (node.type === 'triangle') {
    const [x0, y0, x1, y1, x2, y2] = trianglePoints(node)
    lines.push(fill ? `  d.fillTriangle(${x0}, ${y0}, ${x1}, ${y1}, ${x2}, ${y2}, ${ink});` : `  d.drawTriangle(${x0}, ${y0}, ${x1}, ${y1}, ${x2}, ${y2}, ${ink});`)
    return lines
  }
  if (node.type === 'polygon') {
    const pts = pentagonPoints(node)
    pts.forEach((point, index) => {
      const next = pts[(index + 1) % pts.length]
      if (next) lines.push(`  d.drawLine(${point.x}, ${point.y}, ${next.x}, ${next.y}, ${ink});`)
    })
    return lines
  }
  if (node.type === 'text') {
    lines.push(`  d.setCursor(${x}, ${y});`)
    lines.push(`  d.setTextColor(${ink});`)
    lines.push(`  d.print(${cString(node.text || node.name)});`)
    return lines
  }
  if (node.type === 'image') {
    const ident = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'image'
    if (flags.declareImages) lines.push(`  d.drawBitmap(${x}, ${y}, ${ident}_bits, ${w}, ${h}, ${ink});`)
    return lines
  }

  if (fill) lines.push(`  d.fillRect(${x}, ${y}, ${w}, ${h}, ${ink});`)
  if (stroke || !fill) lines.push(`  d.drawRect(${x}, ${y}, ${w}, ${h}, ${ink});`)
  return lines
}

function imageDecls(nodes: SceneNode[], flags: Flags): string[] {
  if (!flags.declareImages) return []
  const images = nodes.filter((node) => node.type === 'image')
  return images.map((node) => {
    const ident = node.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'image'
    const w = i(Math.abs(node.w ?? 1))
    const h = i(Math.abs(node.h ?? 1))
    return `static const unsigned char ${ident}_bits[] PROGMEM = { /* ${w}x${h} */ };`
  })
}

export function generateCode(document: IvecDocument, screen: Screen): string {
  const flags = flagsOf(document)
  const nodes = visibleNodes(screen)
  const { width, height, library } = document.device
  const gfx = isGfx(library)
  const header = `// ${screen.name} — ${width}x${height} ${gfx ? gfxName(library) : 'u8g2'}`
  const decls = imageDecls(nodes, flags)
  const body = nodes.flatMap((node) => (gfx ? emitGfx(node, flags, inkLiteral(document, node, gfx)) : emitU8g2(node, flags)))
  const prefix = screen.userCode.prefix.trim()
  const suffix = screen.userCode.suffix.trim()
  const inner: string[] = []
  if (prefix) inner.push(prefix, '')
  if (flags.clearDisplay) inner.push(gfx ? '  d.fillScreen(0);' : '  u8g2.clearBuffer();')
  if (body.length) inner.push(...body)
  else if (flags.comments) inner.push('  // boş ekran')
  if (!gfx && flags.clearDisplay) inner.push('  u8g2.sendBuffer();')
  if (suffix) inner.push('', suffix)

  const fnName = `draw_${screen.cIdentifier}`
  const signature = gfx ? `void ${fnName}(${gfxHandle(library)})` : `void ${fnName}(U8G2 &u8g2)`
  const block = flags.wrapperFunction
    ? [`${signature} {`, ...inner, `}`]
    : inner.map((line) => line.replace(/^  /, ''))

  return [header, '// ivec:begin generated', ...decls, ...block, '// ivec:end generated', ''].filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')
}
