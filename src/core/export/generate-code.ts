import { isColorDisplay, rgb565Literal } from '@/core/color/rgb565'
import { toCIdentifier, type ExportTarget, type IvecDocument, type SceneNode, type Screen } from '@/core/document/model'
import { paintPoints } from '@/core/document/paint'
import { resolveFont, textBaselineY } from '@/core/fonts/bitmap-font'
import { clampCornerRadius } from '@/core/render/pixel-buffer'

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

function colorValue(color: SceneNode['color']): 0 | 1 | 2 {
  if (color === 'invert') return 2
  if (color === 0 || color === '0') return 0
  return 1
}

function wantsFill(node: SceneNode): boolean {
  return node.fill !== false
}

function wantsStroke(node: SceneNode): boolean {
  return (node.stroke ?? 0) > 0 || node.fill === false
}

function i(value: number): number {
  return Math.round(value)
}

const ARC_OPTION = 'U8G2_DRAW_UPPER_LEFT | U8G2_DRAW_LOWER_LEFT | U8G2_DRAW_LOWER_RIGHT'

function arcSegments(node: SceneNode): [number, number, number, number][] {
  const w = Math.abs(node.w ?? 1)
  const h = Math.abs(node.h ?? 1)
  const rx = Math.max(1, Math.round(w / 2))
  const ry = Math.max(1, Math.round(h / 2))
  const cx = Math.round(node.x) + rx
  const cy = Math.round(node.y) + ry
  const steps = 16
  const lines: [number, number, number, number][] = []
  let prevX = cx + rx
  let prevY = cy
  for (let step = 1; step <= steps; step += 1) {
    const rad = ((270 * step) / steps) * (Math.PI / 180)
    const nextX = Math.round(cx + rx * Math.cos(rad))
    const nextY = Math.round(cy + ry * Math.sin(rad))
    lines.push([prevX, prevY, nextX, nextY])
    prevX = nextX
    prevY = nextY
  }
  return lines
}

function cString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function fontSymbol(font?: string): string {
  return resolveFont(font).u8g2
}

let imageNames = new Map<string, string>()

function assignImageNames(nodes: SceneNode[]): Map<string, string> {
  const used = new Set<string>()
  const names = new Map<string, string>()
  for (const node of nodes) {
    if (node.type !== 'image' && node.type !== 'paint') continue
    names.set(node.id, toCIdentifier(node.name, used))
  }
  return names
}

function imageIdent(node: SceneNode): string {
  return imageNames.get(node.id) ?? toCIdentifier(node.name)
}

function imageFrameCount(node: SceneNode): number {
  return node.frames?.length && node.frames.length > 1 ? node.frames.length : 0
}

function imageBitsExpr(node: SceneNode, ident: string): string {
  const count = imageFrameCount(node)
  if (!count) return `${ident}_bits`
  const ms = Math.max(1, Math.round(1000 / Math.max(1, node.fps ?? 8)))
  return `${ident}_frames[(millis() / ${ms}) % ${count}]`
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
  const fillInk = colorValue(node.color)
  const strokeInk = colorValue(node.strokeColor ?? node.color)
  let lastInk: number | null = null
  const setInk = (ink: number) => {
    if (lastInk === ink) return
    lines.push(`  u8g2.setDrawColor(${ink});`)
    lastInk = ink
  }
  const x = i(node.x)
  const y = i(node.y)
  const w = i(Math.abs(node.w ?? 1))
  const h = i(Math.abs(node.h ?? 1))
  const fill = wantsFill(node)
  const stroke = wantsStroke(node)

  if (node.type === 'paint' && node.points?.length) {
    setInk(strokeInk)
    for (const point of paintPoints(node)) lines.push(`  u8g2.drawPixel(${point.x}, ${point.y});`)
    return lines
  }
  if (node.type === 'line' || node.type === 'polyline' || node.type === 'paint') {
    setInk(strokeInk)
    lines.push(`  u8g2.drawLine(${i(node.x)}, ${i(node.y)}, ${i(node.x + (node.w ?? 0))}, ${i(node.y + (node.h ?? 0))});`)
    return lines
  }
  if (node.type === 'ellipse' || node.type === 'arc') {
    const rx = Math.max(1, Math.round(w / 2))
    const ry = Math.max(1, Math.round(h / 2))
    const cx = x + rx
    const cy = y + ry
    const option = node.type === 'arc' ? ARC_OPTION : 'U8G2_DRAW_ALL'
    if (fill) {
      setInk(fillInk)
      lines.push(
        node.type !== 'arc' && rx === ry
          ? `  u8g2.drawDisc(${cx}, ${cy}, ${rx});`
          : `  u8g2.drawFilledEllipse(${cx}, ${cy}, ${rx}, ${ry}, ${option});`
      )
    }
    if (stroke) {
      setInk(strokeInk)
      lines.push(
        node.type !== 'arc' && rx === ry
          ? `  u8g2.drawCircle(${cx}, ${cy}, ${rx});`
          : `  u8g2.drawEllipse(${cx}, ${cy}, ${rx}, ${ry}, ${option});`
      )
    }
    return lines
  }
  if (node.type === 'triangle') {
    const [x0, y0, x1, y1, x2, y2] = trianglePoints(node)
    if (fill) {
      setInk(fillInk)
      lines.push(`  u8g2.drawTriangle(${x0}, ${y0}, ${x1}, ${y1}, ${x2}, ${y2});`)
    }
    if (stroke) {
      setInk(strokeInk)
      lines.push(`  u8g2.drawLine(${x0}, ${y0}, ${x1}, ${y1});`)
      lines.push(`  u8g2.drawLine(${x1}, ${y1}, ${x2}, ${y2});`)
      lines.push(`  u8g2.drawLine(${x2}, ${y2}, ${x0}, ${y0});`)
    }
    return lines
  }
  if (node.type === 'polygon') {
    setInk(strokeInk)
    const pts = pentagonPoints(node)
    pts.forEach((point, index) => {
      const next = pts[(index + 1) % pts.length]
      if (next) lines.push(`  u8g2.drawLine(${point.x}, ${point.y}, ${next.x}, ${next.y});`)
    })
    return lines
  }
  if (node.type === 'text') {
    setInk(fillInk)
    if (flags.includeFonts) {
      lines.push(`  u8g2.setFont(${fontSymbol(node.font)});`)
    }
    lines.push(`  u8g2.drawStr(${x}, ${textBaselineY(node)}, ${cString(node.text || node.name)});`)
    return lines
  }
  if (node.type === 'image') {
    setInk(fillInk)
    const ident = imageIdent(node)
    if (flags.declareImages) {
      lines.push(`  u8g2.drawXBMP(${x}, ${y}, ${w}, ${h}, ${imageBitsExpr(node, ident)});`)
    } else if (flags.comments) {
      lines.push(`  // görsel ${node.name} ${w}x${h}`)
    }
    return lines
  }

  const radius = clampCornerRadius(w, h, node.radius ?? 0)
  if (fill) {
    setInk(fillInk)
    lines.push(radius > 0 ? `  u8g2.drawRBox(${x}, ${y}, ${w}, ${h}, ${radius});` : `  u8g2.drawBox(${x}, ${y}, ${w}, ${h});`)
  }
  if (stroke) {
    setInk(strokeInk)
    lines.push(radius > 0 ? `  u8g2.drawRFrame(${x}, ${y}, ${w}, ${h}, ${radius});` : `  u8g2.drawFrame(${x}, ${y}, ${w}, ${h});`)
  }
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

function inkLiteral(document: IvecDocument, color: SceneNode['color'], gfx: boolean): string {
  const hex = typeof color === 'string' && color.startsWith('#')
  if (gfx && (isColorDisplay(document.device.colorMode) || hex)) return rgb565Literal(color)
  const value = colorValue(color)
  return String(value === 2 ? 1 : value)
}

function emitGfx(node: SceneNode, flags: Flags, fillInk: string, strokeInk: string): string[] {
  const lines: string[] = []
  if (flags.comments) lines.push(`  // ${node.name}`)
  const x = i(node.x)
  const y = i(node.y)
  const w = i(Math.abs(node.w ?? 1))
  const h = i(Math.abs(node.h ?? 1))
  const fill = wantsFill(node)
  const stroke = wantsStroke(node)

  if (node.type === 'paint' && node.points?.length) {
    for (const point of paintPoints(node)) lines.push(`  d.drawPixel(${point.x}, ${point.y}, ${strokeInk});`)
    return lines
  }
  if (node.type === 'line' || node.type === 'polyline' || node.type === 'paint') {
    lines.push(`  d.drawLine(${i(node.x)}, ${i(node.y)}, ${i(node.x + (node.w ?? 0))}, ${i(node.y + (node.h ?? 0))}, ${strokeInk});`)
    return lines
  }
  if (node.type === 'ellipse') {
    const rx = Math.max(1, Math.round(w / 2))
    const ry = Math.max(1, Math.round(h / 2))
    const cx = x + rx
    const cy = y + ry
    if (fill) {
      lines.push(rx === ry ? `  d.fillCircle(${cx}, ${cy}, ${rx}, ${fillInk});` : `  d.fillEllipse(${cx}, ${cy}, ${rx}, ${ry}, ${fillInk});`)
    }
    if (stroke) {
      lines.push(rx === ry ? `  d.drawCircle(${cx}, ${cy}, ${rx}, ${strokeInk});` : `  d.drawEllipse(${cx}, ${cy}, ${rx}, ${ry}, ${strokeInk});`)
    }
    return lines
  }
  if (node.type === 'arc') {
    for (const [x0, y0, x1, y1] of arcSegments(node)) {
      lines.push(`  d.drawLine(${x0}, ${y0}, ${x1}, ${y1}, ${stroke ? strokeInk : fillInk});`)
    }
    return lines
  }
  if (node.type === 'triangle') {
    const [x0, y0, x1, y1, x2, y2] = trianglePoints(node)
    if (fill) lines.push(`  d.fillTriangle(${x0}, ${y0}, ${x1}, ${y1}, ${x2}, ${y2}, ${fillInk});`)
    if (stroke) lines.push(`  d.drawTriangle(${x0}, ${y0}, ${x1}, ${y1}, ${x2}, ${y2}, ${strokeInk});`)
    return lines
  }
  if (node.type === 'polygon') {
    const pts = pentagonPoints(node)
    pts.forEach((point, index) => {
      const next = pts[(index + 1) % pts.length]
      if (next) lines.push(`  d.drawLine(${point.x}, ${point.y}, ${next.x}, ${next.y}, ${strokeInk});`)
    })
    return lines
  }
  if (node.type === 'text') {
    lines.push(`  d.setCursor(${x}, ${y});`)
    lines.push(`  d.setTextColor(${fillInk});`)
    lines.push(`  d.setTextSize(${resolveFont(node.font).gfxSize});`)
    lines.push(`  d.print(${cString(node.text || node.name)});`)
    return lines
  }
  if (node.type === 'image') {
    const ident = imageIdent(node)
    if (flags.declareImages) lines.push(`  d.drawBitmap(${x}, ${y}, ${imageBitsExpr(node, ident)}, ${w}, ${h}, ${fillInk});`)
    return lines
  }

  const radius = clampCornerRadius(w, h, node.radius ?? 0)
  if (fill) {
    lines.push(
      radius > 0
        ? `  d.fillRoundRect(${x}, ${y}, ${w}, ${h}, ${radius}, ${fillInk});`
        : `  d.fillRect(${x}, ${y}, ${w}, ${h}, ${fillInk});`
    )
  }
  if (stroke) {
    lines.push(
      radius > 0
        ? `  d.drawRoundRect(${x}, ${y}, ${w}, ${h}, ${radius}, ${strokeInk});`
        : `  d.drawRect(${x}, ${y}, ${w}, ${h}, ${strokeInk});`
    )
  }
  return lines
}

function imageDecls(nodes: SceneNode[], flags: Flags): string[] {
  if (!flags.declareImages) return []
  const lines: string[] = []
  for (const node of nodes.filter((item) => item.type === 'image')) {
    const ident = imageIdent(node)
    const w = i(Math.abs(node.w ?? 1))
    const h = i(Math.abs(node.h ?? 1))
    lines.push(`#include "${ident}.h" /* ${w}x${h}${imageFrameCount(node) ? `, ${imageFrameCount(node)} frames` : ''} */`)
  }
  return lines
}

export function generateCode(document: IvecDocument, screen: Screen): string {
  const flags = flagsOf(document)
  const nodes = visibleNodes(screen)
  imageNames = assignImageNames(nodes)
  const { width, height, library } = document.device
  const gfx = isGfx(library)
  const header = `// ${screen.name} — ${width}x${height} ${gfx ? gfxName(library) : 'u8g2'}`
  const decls = imageDecls(nodes, flags)
  const body = nodes.flatMap((node) =>
    gfx
      ? emitGfx(node, flags, inkLiteral(document, node.color, gfx), inkLiteral(document, node.strokeColor ?? node.color, gfx))
      : emitU8g2(node, flags)
  )
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
