export class PixelBuffer {
  readonly data: Uint32Array

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.data = new Uint32Array(width * height)
  }

  set(x: number, y: number, rgb = 0xffffff): void {
    const px = Math.round(x)
    const py = Math.round(y)
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return
    this.data[py * this.width + px] = 0xff000000 | (rgb & 0xffffff)
  }

  hline(x0: number, x1: number, y: number, rgb = 0xffffff): void {
    const left = Math.min(x0, x1)
    const right = Math.max(x0, x1)
    for (let x = left; x <= right; x += 1) this.set(x, y, rgb)
  }

  vline(x: number, y0: number, y1: number, rgb = 0xffffff): void {
    const top = Math.min(y0, y1)
    const bottom = Math.max(y0, y1)
    for (let y = top; y <= bottom; y += 1) this.set(x, y, rgb)
  }

  fillRoundRect(x: number, y: number, w: number, h: number, radius: number, rgb = 0xffffff): void {
    const width = Math.max(1, Math.round(w))
    const height = Math.max(1, Math.round(h))
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    const rr = clampCornerRadius(width, height, radius)
    if (rr <= 0) {
      this.fillRect(x0, y0, width, height, rgb)
      return
    }
    const xl = x0 + rr
    const xr = x0 + width - rr - 1
    const yu = y0 + rr
    const yl = y0 + height - rr - 1
    this.fillRect(xl, y0, xr - xl + 1, height, rgb)
    this.fillRect(x0, yu, width, yl - yu + 1, rgb)
    const d = rr * 2 + 1
    this.ellipse(xl - rr, yu - rr, d, d, true, rgb)
    this.ellipse(xr - rr, yu - rr, d, d, true, rgb)
    this.ellipse(xl - rr, yl - rr, d, d, true, rgb)
    this.ellipse(xr - rr, yl - rr, d, d, true, rgb)
  }

  strokeRoundRect(x: number, y: number, w: number, h: number, radius: number, stroke = 1, rgb = 0xffffff): void {
    const width = Math.max(1, Math.round(w))
    const height = Math.max(1, Math.round(h))
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    const thick = Math.max(1, Math.round(stroke))
    for (let i = 0; i < thick; i += 1) {
      const inset = i
      const rw = width - inset * 2
      const rh = height - inset * 2
      if (rw < 1 || rh < 1) break
      this.strokeRoundRectOnce(x0 + inset, y0 + inset, rw, rh, Math.max(0, clampCornerRadius(width, height, radius) - inset), rgb)
    }
  }

  fillRect(x: number, y: number, w: number, h: number, rgb = 0xffffff): void {
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    const x1 = x0 + Math.max(1, Math.round(w)) - 1
    const y1 = y0 + Math.max(1, Math.round(h)) - 1
    for (let py = y0; py <= y1; py += 1) this.hline(x0, x1, py, rgb)
  }

  strokeRect(x: number, y: number, w: number, h: number, stroke = 1, rgb = 0xffffff): void {
    const thick = Math.max(1, Math.round(stroke))
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    const width = Math.max(1, Math.round(w))
    const height = Math.max(1, Math.round(h))
    for (let i = 0; i < thick; i += 1) {
      this.hline(x0, x0 + width - 1, y0 + i, rgb)
      this.hline(x0, x0 + width - 1, y0 + height - 1 - i, rgb)
      this.vline(x0 + i, y0, y0 + height - 1, rgb)
      this.vline(x0 + width - 1 - i, y0, y0 + height - 1, rgb)
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, rgb = 0xffffff): void {
    let cx = Math.round(x0)
    let cy = Math.round(y0)
    const tx = Math.round(x1)
    const ty = Math.round(y1)
    const dx = Math.abs(tx - cx)
    const dy = Math.abs(ty - cy)
    const sx = cx < tx ? 1 : -1
    const sy = cy < ty ? 1 : -1
    let err = dx - dy
    while (true) {
      this.set(cx, cy, rgb)
      if (cx === tx && cy === ty) break
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        cx += sx
      }
      if (e2 < dx) {
        err += dx
        cy += sy
      }
    }
  }

  private strokeRoundRectOnce(x0: number, y0: number, width: number, height: number, rr: number, rgb: number): void {
    if (rr <= 0) {
      this.strokeRect(x0, y0, width, height, 1, rgb)
      return
    }
    const xl = x0 + rr
    const xr = x0 + width - rr - 1
    const yu = y0 + rr
    const yl = y0 + height - rr - 1
    this.hline(xl, xr, y0, rgb)
    this.hline(xl, xr, y0 + height - 1, rgb)
    this.vline(x0, yu, yl, rgb)
    this.vline(x0 + width - 1, yu, yl, rgb)
    const d = rr * 2 + 1
    this.ellipse(xl - rr, yu - rr, d, d, false, rgb, (px, py, cx, cy) => px <= cx && py <= cy)
    this.ellipse(xr - rr, yu - rr, d, d, false, rgb, (px, py, cx, cy) => px >= cx && py <= cy)
    this.ellipse(xl - rr, yl - rr, d, d, false, rgb, (px, py, cx, cy) => px <= cx && py >= cy)
    this.ellipse(xr - rr, yl - rr, d, d, false, rgb, (px, py, cx, cy) => px >= cx && py >= cy)
  }

  ellipse(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: boolean,
    rgb = 0xffffff,
    keep?: (px: number, py: number, cx: number, cy: number) => boolean
  ): void {
    const width = Math.max(1, Math.round(w))
    const height = Math.max(1, Math.round(h))
    const rx = Math.max(0, Math.floor((width - 1) / 2))
    const ry = Math.max(0, Math.floor((height - 1) / 2))
    const cx = Math.round(x) + rx
    const cy = Math.round(y) + ry
    const plot = (px: number, py: number) => {
      if (keep && !keep(px, py, cx, cy)) return
      this.set(px, py, rgb)
    }
    if (rx === 0 && ry === 0) {
      plot(cx, cy)
      return
    }
    for (let py = -ry; py <= ry; py += 1) {
      const t = ry === 0 ? 1 : 1 - (py * py) / (ry * ry)
      const dx = t <= 0 ? 0 : Math.floor(rx * Math.sqrt(t) + 1e-6)
      if (fill && !keep) this.hline(cx - dx, cx + dx, cy + py, rgb)
      else if (fill) {
        for (let px = cx - dx; px <= cx + dx; px += 1) plot(px, cy + py)
      } else {
        plot(cx - dx, cy + py)
        plot(cx + dx, cy + py)
      }
    }
    if (!fill) {
      for (let px = -rx; px <= rx; px += 1) {
        const t = rx === 0 ? 1 : 1 - (px * px) / (rx * rx)
        const dy = t <= 0 ? 0 : Math.floor(ry * Math.sqrt(t) + 1e-6)
        plot(cx + px, cy - dy)
        plot(cx + px, cy + dy)
      }
    }
  }

  polygon(points: { x: number; y: number }[], fill: boolean, rgb = 0xffffff, stroke = true, strokeRgb = rgb): void {
    if (points.length < 2) return
    if (fill) this.fillPolygon(points, rgb)
    if (!stroke) return
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      if (a && b) this.line(a.x, a.y, b.x, b.y, strokeRgb)
    }
  }

  blit(
    src: Uint8Array,
    srcW: number,
    srcH: number,
    x: number,
    y: number,
    w: number,
    h: number,
    rgb = 0xffffff,
    flipX = false,
    flipY = false
  ): void {
    const dw = Math.max(1, Math.round(w))
    const dh = Math.max(1, Math.round(h))
    const ox = Math.round(x)
    const oy = Math.round(y)
    for (let py = 0; py < dh; py += 1) {
      const sy0 = Math.min(srcH - 1, Math.floor((py * srcH) / dh))
      const sy = flipY ? srcH - 1 - sy0 : sy0
      for (let px = 0; px < dw; px += 1) {
        const sx0 = Math.min(srcW - 1, Math.floor((px * srcW) / dw))
        const sx = flipX ? srcW - 1 - sx0 : sx0
        if (src[sy * srcW + sx]) this.set(ox + px, oy + py, rgb)
      }
    }
  }

  private fillPolygon(points: { x: number; y: number }[], rgb: number): void {
    const ys = points.map((p) => Math.round(p.y))
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    for (let y = minY; y <= maxY; y += 1) {
      const xs: number[] = []
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]
        const b = points[(i + 1) % points.length]
        if (!a || !b) continue
        const y0 = a.y
        const y1 = b.y
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          const t = (y - y0) / (y1 - y0 || 1)
          xs.push(Math.round(a.x + t * (b.x - a.x)))
        }
      }
      xs.sort((m, n) => m - n)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const left = xs[i]
        const right = xs[i + 1]
        if (left !== undefined && right !== undefined) this.hline(left, right, y, rgb)
      }
    }
  }
}

export function clampCornerRadius(w: number, h: number, radius: number): number {
  return Math.max(0, Math.min(Math.round(radius), Math.floor((Math.max(1, w) - 1) / 2), Math.floor((Math.max(1, h) - 1) / 2)))
}
