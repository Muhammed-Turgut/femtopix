import { useEffect, useRef } from 'react'
import type { SceneNode } from '@/core/document/model'
import { animatedAsset } from '@/core/gallery/animations'
import { rgbaToMono, type MonoBitmap } from '@/core/render/draw-node'
import { nodeBounds, rasterizeNode } from '@/core/render/raster-node'

function sampleMono(source: CanvasImageSource, w: number, h: number): MonoBitmap {
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

function loadMono(src: string, w: number, h: number): Promise<MonoBitmap> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const finish = () => resolve(sampleMono(image, w, h))
    image.onload = () => {
      const decoded = image.decode?.()
      if (decoded) void decoded.then(finish).catch(finish)
      else finish()
    }
    image.onerror = () => reject(new Error('image'))
    image.src = src
  })
}

export function NodeThumb({ node, size = 32 }: { node: SceneNode; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    const sources = node.type === 'image' ? (node.frames?.length ? node.frames : node.asset ? [node.asset] : []) : []
    const { w, h } = nodeBounds(node)
    const bitmaps = new Map<string, MonoBitmap>()
    const paint = () => {
      const canvas = ref.current
      if (!canvas || cancelled) return
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, size, size)
      const asset = animatedAsset(node, Date.now())
      const buffer = rasterizeNode(asset && asset !== node.asset ? { ...node, asset } : node, bitmaps)
      const image = ctx.createImageData(size, size)
      for (let py = 0; py < size; py += 1) {
        const sy = Math.min(buffer.height - 1, Math.floor((py * buffer.height) / size))
        for (let px = 0; px < size; px += 1) {
          const sx = Math.min(buffer.width - 1, Math.floor((px * buffer.width) / size))
          const src = buffer.data[sy * buffer.width + sx] ?? 0
          const i = (py * size + px) * 4
          if (!src) continue
          image.data[i] = (src >> 16) & 255
          image.data[i + 1] = (src >> 8) & 255
          image.data[i + 2] = src & 255
          image.data[i + 3] = 255
        }
      }
      ctx.putImageData(image, 0, 0)
    }
    void Promise.all(
      sources.map(async (src) => {
        try {
          bitmaps.set(`${src}:${w}x${h}`, await loadMono(src, w, h))
        } catch {
          /* keep empty thumb */
        }
      })
    ).then(() => {
      if (cancelled) return
      paint()
      if (sources.length > 1) {
        const ms = Math.max(70, Math.round(1000 / Math.max(1, node.fps ?? 8)))
        timer = window.setInterval(paint, ms)
      }
    })
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [node, size])

  return <canvas ref={ref} width={size} height={size} className="size-8" style={{ imageRendering: 'pixelated' }} />
}
