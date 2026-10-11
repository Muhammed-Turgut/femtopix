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

function formatByteRows(bits: Uint8Array): string[] {
  const hex = [...bits].map((byte) => `0x${byte.toString(16).padStart(2, '0')}`)
  if (!hex.length) return []
  const rows: string[] = []
  for (let i = 0; i < hex.length; i += 12) {
    const chunk = hex.slice(i, i + 12).join(', ')
    rows.push(`  ${chunk}${i + 12 < hex.length ? ',' : ''}`)
  }
  return rows
}

function formatBitsArray(symbol: string, bits: Uint8Array): string[] {
  return [`static const unsigned char ${symbol}[] PROGMEM = {`, ...formatByteRows(bits), `};`]
}

export function formatXbmHeader(options: {
  ident: string
  name: string
  width: number
  height: number
  bits: Uint8Array
}): string {
  const { ident, name, width, height, bits } = options
  return [
    `#pragma once`,
    `// ${name} — ${width}x${height} XBMP`,
    `#define ${ident}_width ${width}`,
    `#define ${ident}_height ${height}`,
    ...formatBitsArray(`${ident}_bits`, bits),
    ``
  ].join('\n')
}

export function formatAnimationHeader(options: {
  ident: string
  name: string
  width: number
  height: number
  fps: number
  frames: Uint8Array[]
}): string {
  const { ident, name, width, height, fps, frames } = options
  const names = frames.map((_, index) => `${ident}_${index}_bits`)
  const arrays = frames.flatMap((bits, index) => ['', ...formatBitsArray(names[index] ?? `${ident}_${index}_bits`, bits)])
  return [
    `#pragma once`,
    `// ${name} — ${width}x${height}, ${frames.length} frames @ ${fps} fps`,
    `#define ${ident}_width ${width}`,
    `#define ${ident}_height ${height}`,
    `#define ${ident}_frame_count ${frames.length}`,
    `#define ${ident}_fps ${fps}`,
    ...arrays,
    ``,
    `static const unsigned char* const ${ident}_frames[] PROGMEM = { ${names.join(', ')} };`,
    ``
  ].join('\n')
}
