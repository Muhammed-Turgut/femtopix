import { describe, expect, it } from 'vitest'
import { tokenizeLine } from '@/ui/primitives/CodeView'

function ofKind(line: string, kind: string): string[] {
  return tokenizeLine(line).filter((token) => token.kind === kind).map((token) => token.text)
}

describe('code highlight', () => {
  it('paints void as a keyword and the wrapper as a function', () => {
    const line = 'void draw_screen_1(U8G2 &u8g2) {'
    expect(ofKind(line, 'keyword')).toEqual(['void'])
    expect(ofKind(line, 'fn')).toEqual(['draw_screen_1'])
    expect(ofKind(line, 'type')).toEqual(['U8G2'])
  })

  it('separates method names and hex colors from the rest', () => {
    const line = '  d.fillRect(48, 48, 120, 96, 0xf800);'
    expect(ofKind(line, 'fn')).toEqual(['fillRect'])
    expect(ofKind(line, 'number')).toEqual(['48', '48', '120', '96', '0xf800'])
  })
})
