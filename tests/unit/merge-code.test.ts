import { describe, expect, it } from 'vitest'
import { mergeCode } from '@/core/export/merge-code'

const base = ['void draw() {', '  d.fillScreen(0);', '  d.setCursor(10, 20);', '  d.print("Hi");', '}'].join('\n')

describe('mergeCode', () => {
  it('keeps a hand-added line when the canvas moves a shape', () => {
    const ours = base.replace('  d.print("Hi");', '  d.print("Hi");\n  uiPrint(83, 114, "select");')
    const theirs = base.replace('setCursor(10, 20)', 'setCursor(12, 24)')
    const result = mergeCode(base, ours, theirs)
    expect(result.conflict).toBe(false)
    expect(result.code).toContain('d.setCursor(12, 24);')
    expect(result.code).toContain('uiPrint(83, 114, "select");')
  })

  it('keeps the hand-edited line when both change the same line', () => {
    const ours = base.replace('setCursor(10, 20)', 'setCursor(0, 0)')
    const theirs = base.replace('setCursor(10, 20)', 'setCursor(12, 24)')
    const result = mergeCode(base, ours, theirs)
    expect(result.conflict).toBe(true)
    expect(result.code).toContain('d.setCursor(0, 0);')
  })

  it('follows the canvas when nothing was edited', () => {
    const theirs = base.replace('"Hi"', '"Yo"')
    expect(mergeCode(base, base, theirs)).toEqual({ code: theirs, conflict: false })
  })
})
