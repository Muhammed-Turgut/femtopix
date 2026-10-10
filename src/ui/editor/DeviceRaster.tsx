import { useEffect, useRef, useState } from 'react'
import { expandRgb565, isColorDisplay, parseCssHex } from '@/core/color/rgb565'
import type { ColorMode, SceneNode } from '@/core/document/model'
import { drawNode, rgbaToMono, type MonoBitmap } from '@/core/render/draw-node'
import { PixelBuffer } from '@/core/render/pixel-buffer'

const bitmaps = new Map<string, MonoBitmap>()
const loading = new Set<string>()

function sampleCanvas(source: CanvasImageSource, w: number, h: number): MonoBitmap {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: w, height: h, data: new Uint8Array(w * h) }
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  return rgbaToMono(ctx.getImageData(0, 0, w, h).data, w, h)
}

function loadImageBitmap(key: string, src: string, w: number, h: number, ready: () => void): void {
  if (bitmaps.has(key) || loading.has(key)) return
  loading.add(key)
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    bitmaps.set(key, sampleCanvas(image, w, h))
    loading.delete(key)
    ready()
  }
  image.onerror = () => loading.delete(key)
  image.src = src
}

function loadTextBitmap(key: string, text: string, w: number, h: number, ready: () => void): void {
  if (bitmaps.has(key) || loading.has(key)) return
  loading.add(key)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    loading.delete(key)
    return
  }
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.font = `${Math.max(6, h)}px "IBM Plex Mono", "JetBrains Mono", monospace`
  ctx.textBaseline = 'top'
  ctx.fillText(text, 0, 0)
  bitmaps.set(key, rgbaToMono(ctx.getImageData(0, 0, w, h).data, w, h))
  loading.delete(key)
  ready()
}

export function DeviceRaster({
  nodes,
  width,
  height,
  zoom,
  colorMode,
  pixelOn
}: {
  nodes: SceneNode[]
  width: number
  height: number
  zoom: number
  colorMode: ColorMode
  pixelOn: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [rev, setRev] = useState(0)
  const ready = () => setRev((value) => value + 1)

  useEffect(() => {
    for (const node of nodes) {
      const w = Math.max(1, Math.round(Math.abs(node.w ?? 1)))
      const h = Math.max(1, Math.round(Math.abs(node.h ?? 1)))
      if (node.type === 'image' && node.asset) {
        loadImageBitmap(`${node.asset}:${w}x${h}`, node.asset, w, h, ready)
      }
      if (node.type === 'text') {
        loadTextBitmap(`text:${node.text || node.name}:${w}x${h}:${node.font ?? ''}`, node.text || node.name, w, h, ready)
      }
    }
  }, [nodes])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    const buffer = new PixelBuffer(width, height)
    for (const node of nodes) drawNode(buffer, node, bitmaps)
    const image = ctx.createImageData(width, height)
    const mono = parseCssHex(pixelOn) ?? { r: 255, g: 255, b: 255 }
    const color = isColorDisplay(colorMode)
    for (let i = 0; i < buffer.data.length; i += 1) {
      const px = buffer.data[i] ?? 0
      if (!px) continue
      let r = (px >> 16) & 255
      let g = (px >> 8) & 255
      let b = px & 255
      if (colorMode === 'rgb565') {
        const snapped = parseCssHex(expandRgb565(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3))) ?? { r, g, b }
        r = snapped.r
        g = snapped.g
        b = snapped.b
      }
      if (!color) {
        r = mono.r
        g = mono.g
        b = mono.b
      }
      image.data[i * 4] = r
      image.data[i * 4 + 1] = g
      image.data[i * 4 + 2] = b
      image.data[i * 4 + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }, [nodes, width, height, colorMode, pixelOn, rev])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0"
      style={{
        width: width * zoom,
        height: height * zoom,
        imageRendering: 'pixelated'
      }}
    />
  )
}
