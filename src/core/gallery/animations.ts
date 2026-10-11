import type { SceneNode } from '@/core/document/model'

export interface GalleryAnimFrame {
  file: string
  url: string
}

export interface GalleryAnimation {
  id: string
  name: { tr: string; en: string }
  fps: number
  size: number
  frames: GalleryAnimFrame[]
}

interface AnimFile {
  name?: { tr?: string; en?: string }
  fps?: number
  size?: number
}

function titleFromSlug(slug: string): string {
  const words = slug.replace(/[_-]+/g, ' ').trim()
  if (!words) return slug
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function animParts(path: string): { id: string; file: string } | null {
  const match = path.replaceAll('\\', '/').match(/gallery\/animations\/([^/]+)\/([^/]+)$/)
  if (!match) return null
  return { id: match[1], file: match[2] }
}

export function animationFrameIndex(node: Pick<SceneNode, 'frames' | 'fps'>, now = Date.now()): number {
  const frames = node.frames
  if (!frames?.length) return 0
  const fps = Math.max(1, node.fps ?? 8)
  return Math.floor(now / (1000 / fps)) % frames.length
}

export function animatedAsset(node: Pick<SceneNode, 'asset' | 'frames' | 'fps'>, now = Date.now()): string | undefined {
  if (node.frames?.length) return node.frames[animationFrameIndex(node, now)]
  return node.asset
}

export function groupAnimations(
  images: Record<string, string>,
  metas: Record<string, AnimFile>
): GalleryAnimation[] {
  const byId = new Map<string, GalleryAnimation>()
  const ensure = (id: string): GalleryAnimation => {
    const existing = byId.get(id)
    if (existing) return existing
    const created: GalleryAnimation = {
      id,
      name: { tr: titleFromSlug(id), en: titleFromSlug(id) },
      fps: 8,
      size: 16,
      frames: []
    }
    byId.set(id, created)
    return created
  }

  for (const [path, url] of Object.entries(images)) {
    const parts = animParts(path)
    if (!parts || !/\.(svg|png)$/i.test(parts.file)) continue
    ensure(parts.id).frames.push({ file: parts.file, url })
  }

  for (const [path, meta] of Object.entries(metas)) {
    const parts = animParts(path)
    if (!parts) continue
    const anim = ensure(parts.id)
    if (meta.name?.tr) anim.name.tr = meta.name.tr
    if (meta.name?.en) anim.name.en = meta.name.en
    if (typeof meta.fps === 'number') anim.fps = meta.fps
    if (typeof meta.size === 'number') anim.size = meta.size
  }

  return [...byId.values()]
    .map((anim) => ({
      ...anim,
      frames: [...anim.frames].sort((a, b) => a.file.localeCompare(b.file, 'en'))
    }))
    .filter((anim) => anim.frames.length > 1)
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

export function loadAnimations(): GalleryAnimation[] {
  const images = import.meta.glob('../../../gallery/animations/*/*.{svg,png}', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>
  const metas = import.meta.glob('../../../gallery/animations/*/anim.json', {
    eager: true,
    import: 'default'
  }) as Record<string, AnimFile>
  return groupAnimations(images, metas)
}
