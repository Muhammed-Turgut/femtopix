export interface GalleryIcon {
  id: string
  name: string
  file: string
  url: string
}

export interface GalleryCategory {
  id: string
  name: { tr: string; en: string }
  order: number
  icons: GalleryIcon[]
}

export interface CategoryFile {
  name?: { tr?: string; en?: string }
  order?: number
}

function titleFromSlug(slug: string): string {
  const words = slug.replace(/[_-]+/g, ' ').trim()
  if (!words) return slug
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function galleryParts(path: string): { category: string; file: string } | null {
  const match = path.replaceAll('\\', '/').match(/gallery\/([^/]+)\/([^/]+)$/)
  if (!match) return null
  return { category: match[1], file: match[2] }
}

export function isGallerySvg(file: string): boolean {
  return file.toLowerCase().endsWith('.svg')
}

export function groupGallery(
  images: Record<string, string>,
  metas: Record<string, CategoryFile>
): GalleryCategory[] {
  const byCategory = new Map<string, GalleryCategory>()

  const ensure = (id: string): GalleryCategory => {
    const existing = byCategory.get(id)
    if (existing) return existing
    const created: GalleryCategory = {
      id,
      name: { tr: titleFromSlug(id), en: titleFromSlug(id) },
      order: 100,
      icons: []
    }
    byCategory.set(id, created)
    return created
  }

  for (const [path, url] of Object.entries(images)) {
    const parts = galleryParts(path)
    if (!parts || parts.file === 'category.json' || !isGallerySvg(parts.file)) continue
    const base = parts.file.replace(/\.[^.]+$/, '')
    ensure(parts.category).icons.push({
      id: base,
      name: titleFromSlug(base),
      file: parts.file,
      url
    })
  }

  for (const [path, meta] of Object.entries(metas)) {
    const parts = galleryParts(path)
    if (!parts) continue
    const category = ensure(parts.category)
    if (meta.name?.tr) category.name.tr = meta.name.tr
    if (meta.name?.en) category.name.en = meta.name.en
    if (typeof meta.order === 'number') category.order = meta.order
  }

  return [...byCategory.values()]
    .map((category) => ({
      ...category,
      icons: [...category.icons].sort((a, b) => a.file.localeCompare(b.file, 'en'))
    }))
    .filter((category) => category.icons.length > 0)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'en'))
}

export function loadGallery(): GalleryCategory[] {
  const images = import.meta.glob('../../../gallery/*/*.svg', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>
  const metas = import.meta.glob('../../../gallery/*/category.json', {
    eager: true,
    import: 'default'
  }) as Record<string, CategoryFile>
  return groupGallery(images, metas)
}
