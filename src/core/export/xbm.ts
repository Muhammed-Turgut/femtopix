export function packXbm(pixels: ArrayLike<number>, width: number, height: number): Uint8Array {
  const rowBytes = Math.max(1, Math.ceil(width / 8))
  const out = new Uint8Array(rowBytes * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!pixels[y * width + x]) continue
      out[y * rowBytes + (x >> 3)] |= 1 << (x & 7)
    }
  }
  return out
}

export function formatXbmHeader(options: {
  ident: string
  name: string
  width: number
  height: number
  bits: Uint8Array
}): string {
  const { ident, name, width, height, bits } = options
  const hex = [...bits].map((byte) => `0x${byte.toString(16).padStart(2, '0')}`)
  const rows: string[] = []
  for (let i = 0; i < hex.length; i += 12) {
    const chunk = hex.slice(i, i + 12).join(', ')
    rows.push(`  ${chunk}${i + 12 < hex.length ? ',' : ''}`)
  }
  return [
    `#pragma once`,
    `// ${name} — ${width}x${height} XBMP`,
    `#define ${ident}_width ${width}`,
    `#define ${ident}_height ${height}`,
    `static const unsigned char ${ident}_bits[] PROGMEM = {`,
    ...rows,
    `};`,
    ``
  ].join('\n')
}
