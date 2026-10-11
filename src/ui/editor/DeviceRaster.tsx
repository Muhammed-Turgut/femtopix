import { useEffect, useRef, useState } from 'react'
import { expandRgb565, isColorDisplay, parseCssHex } from '@/core/color/rgb565'
import type { ColorMode, SceneNode } from '@/core/document/model'
import { animatedAsset } from '@/core/gallery/animations'
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
  const finish = () => {
    bitmaps.set(key, sampleCanvas(image, w, h))
    loading.delete(key)
    ready()
  }
  image.onload = () => {
    const decoded = image.decode?.()
    if (decoded) void decoded.then(finish).catch(finish)
    else finish()
  }
  image.onerror = () => loading.delete(key)
  image.src = src
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
      const sources = node.type === 'image' ? (node.frames?.length ? node.frames : node.asset ? [node.asset] : []) : []
      for (const src of sources) loadImageBitmap(`${src}:${w}x${h}`, src, w, h, ready)
    }
  }, [nodes])

  const playing = nodes.some((node) => (node.frames?.length ?? 0) > 1)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setRev((value) => value + 1), 80)
    return () => window.clearInterval(id)
  }, [playing])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    const buffer = new PixelBuffer(width, height)
    const now = Date.now()
    for (const node of nodes) {
      const asset = animatedAsset(node, now)
      drawNode(buffer, asset && asset !== node.asset ? { ...node, asset } : node, bitmaps)
    }
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
      if (!color && r === 255 && g === 255 && b === 255) {
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
