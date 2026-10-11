import { useEffect, useRef } from 'react'
import type { SceneNode } from '@/core/document/model'
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
    image.decoding = 'async'
    image.onload = () => resolve(sampleMono(image, w, h))
    image.onerror = () => reject(new Error('image'))
    image.src = src
  })
}

export function NodeThumb({ node, size = 32 }: { node: SceneNode; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const paint = async () => {
      const canvas = ref.current
      if (!canvas) return
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, size, size)
      const bitmaps = new Map<string, MonoBitmap>()
      const { w, h } = nodeBounds(node)
      if (node.type === 'image' && node.asset) {
        try {
          bitmaps.set(`${node.asset}:${w}x${h}`, await loadMono(node.asset, w, h))
        } catch {
          /* keep empty thumb */
        }
      }
      if (cancelled) return
      const buffer = rasterizeNode(node, bitmaps)
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
    void paint()
    return () => {
      cancelled = true
    }
  }, [node, size])

  return <canvas ref={ref} width={size} height={size} className="size-8" style={{ imageRendering: 'pixelated' }} />
}
