import { describe, expect, it } from 'vitest'
import { filterGalleryIcons, groupGallery, loadGallery } from '@/core/gallery/catalog'

describe('groupGallery', () => {
  it('groups files by category folder and applies category.json names', () => {
    const categories = groupGallery(
      {
        '../../../gallery/school-science/dna.svg': '/dna.svg',
        '../../../gallery/school-science/bag.svg': '/bag.svg',
        '../../../gallery/school-science/bag.png': '/bag.png'
      },
      {
        '../../../gallery/school-science/category.json': {
          name: { tr: 'Okul ve bilim', en: 'School & science' },
          order: 1
        }
      }
    )

    expect(categories).toHaveLength(1)
    expect(categories[0]?.name.tr).toBe('Okul ve bilim')
    expect(categories[0]?.icons.map((icon) => icon.file)).toEqual(['bag.svg', 'dna.svg'])
  })

  it('ignores raster files so only svg icons are listed', () => {
    const categories = groupGallery(
      {
        '../../../gallery/school-science/dna.png': '/dna.png',
        '../../../gallery/weather/cloud.webp': '/cloud.webp'
      },
      {}
    )
    expect(categories).toEqual([])
  })

  it('titles a folder that has no category.json', () => {
    const categories = groupGallery({ '../../../gallery/weather/cloud.svg': '/cloud.svg' }, {})
    expect(categories[0]?.name.en).toBe('Weather')
    expect(categories[0]?.icons[0]?.name).toBe('Cloud')
  })
})

describe('filterGalleryIcons', () => {
  it('filters by category and query', () => {
    const categories = groupGallery(
      {
        '../../../gallery/weather/cloud.svg': '/cloud.svg',
        '../../../gallery/weather/sun.svg': '/sun.svg',
        '../../../gallery/food/cup.svg': '/cup.svg'
      },
      {}
    )
    expect(filterGalleryIcons(categories, '', 'all')).toHaveLength(3)
    expect(filterGalleryIcons(categories, 'sun', 'all').map((icon) => icon.file)).toEqual(['sun.svg'])
    expect(filterGalleryIcons(categories, '', 'food').map((icon) => icon.file)).toEqual(['cup.svg'])
  })
})

describe('loadGallery', () => {
  it('reads every category folder that has icons', () => {
    const categories = loadGallery()
    const icons = categories.reduce((sum, category) => sum + category.icons.length, 0)
    expect(categories.map((category) => category.id).sort()).toEqual(
      [
        'building',
        'business',
        'chat',
        'coding',
        'computers',
        'content',
        'design',
        'ecology',
        'events',
        'food',
        'hand -signs',
        'health',
        'interface',
        'internet',
        'kenney',
        'logo',
        'map',
        'money',
        'music',
        'pet',
        'phone',
        'photography',
        'pixel',
        'pixel-brands',
        'pixel-solid',
        'pixel-topics',
        'pixelart',
        'romance',
        'shopping',
        'social',
        'technology',
        'transportation',
        'travel',
        'user',
        'videos',
        'weather'
      ].sort()
    )
    expect(icons).toBe(2500)
    expect(categories.every((category) => category.icons.every((icon) => icon.file.endsWith('.svg')))).toBe(true)
    expect(categories.find((category) => category.id === 'school-science')).toBeUndefined()
    expect(categories.find((category) => category.id === 'weather')?.name.tr).toBe('Hava')
    expect(categories.find((category) => category.id === 'weather')?.icons).toHaveLength(10)
  })

  it('reads weather svg icons from disk', () => {
    const weather = loadGallery().find((category) => category.id === 'weather')
    expect(weather?.icons.every((icon) => icon.file.endsWith('.svg') && icon.url.length > 0)).toBe(true)
  })
})
