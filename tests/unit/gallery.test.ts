import { describe, expect, it } from 'vitest'
import { groupGallery, loadGallery } from '@/core/gallery/catalog'

describe('groupGallery', () => {
  it('groups files by category folder and applies category.json names', () => {
    const categories = groupGallery(
      {
        '../../../gallery/school-science/dna.png': '/dna.png',
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
    expect(categories[0]?.icons.map((icon) => icon.file)).toEqual(['bag.png', 'dna.png'])
  })

  it('titles a folder that has no category.json', () => {
    const categories = groupGallery({ '../../../gallery/weather/cloud.png': '/cloud.png' }, {})
    expect(categories[0]?.name.en).toBe('Weather')
    expect(categories[0]?.icons[0]?.name).toBe('Cloud')
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
        'logo',
        'map',
        'money',
        'music',
        'pet',
        'phone',
        'photography',
        'romance',
        'school-science',
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
    expect(icons).toBe(662)
    expect(categories.find((category) => category.id === 'weather')?.name.tr).toBe('Hava')
    expect(categories.find((category) => category.id === 'weather')?.icons).toHaveLength(10)
  })

  it('reads the school-science icons from disk', () => {
    const school = loadGallery().find((category) => category.id === 'school-science')
    expect(school?.name.tr).toBe('Okul ve bilim')
    expect(school?.icons.map((icon) => icon.file)).toEqual([
      'bag.png',
      'dna.png',
      'graduation-cap.png',
      'test-flask.png'
    ])
    expect(school?.icons.every((icon) => icon.url.length > 0)).toBe(true)
  })
})
