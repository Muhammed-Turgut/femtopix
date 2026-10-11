import { describe, expect, it } from 'vitest'
import { animatedAsset, animationFrameIndex, groupAnimations, loadAnimations } from '@/core/gallery/animations'

describe('groupAnimations', () => {
  it('keeps only sequences with more than one svg frame', () => {
    const anims = groupAnimations(
      {
        '../../../gallery/animations/spinner/00.svg': '/0.svg',
        '../../../gallery/animations/spinner/01.svg': '/1.svg',
        '../../../gallery/animations/lonely/00.svg': '/lonely.svg'
      },
      {
        '../../../gallery/animations/spinner/anim.json': {
          name: { tr: 'Yükleniyor', en: 'Loading' },
          fps: 8
        }
      }
    )
    expect(anims).toHaveLength(1)
    expect(anims[0]?.id).toBe('spinner')
    expect(anims[0]?.name.tr).toBe('Yükleniyor')
    expect(anims[0]?.frames.map((frame) => frame.file)).toEqual(['00.svg', '01.svg'])
  })
})

describe('animationFrameIndex', () => {
  it('walks frames from fps and the clock', () => {
    expect(animationFrameIndex({ frames: ['a', 'b', 'c', 'd'], fps: 4 }, 0)).toBe(0)
    expect(animationFrameIndex({ frames: ['a', 'b', 'c', 'd'], fps: 4 }, 250)).toBe(1)
    expect(animationFrameIndex({ frames: ['a', 'b', 'c', 'd'], fps: 4 }, 1000)).toBe(0)
    expect(animatedAsset({ asset: 'still', frames: ['a', 'b'], fps: 2 }, 500)).toBe('b')
  })
})

describe('loadAnimations', () => {
  it('reads homemade loops and OpenGameArt CC0 packs', () => {
    const anims = loadAnimations()
    const ids = anims.map((anim) => anim.id)
    expect(ids).toEqual(expect.arrayContaining(['spinner', 'wifi', 'oga-heart', 'oga-bar', 'oga-hourglass', 'oga-battery', 'oga-load-001']))
    expect(anims.length).toBeGreaterThanOrEqual(31)
    expect(anims.every((anim) => anim.frames.length > 1)).toBe(true)
    expect(anims.find((anim) => anim.id === 'spinner')?.frames).toHaveLength(8)
    expect(anims.find((anim) => anim.id === 'oga-heart')?.frames.length).toBeGreaterThan(1)
  })
})
