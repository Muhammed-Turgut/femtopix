#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 16
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'gallery', 'animations')

function grid() {
  const cells = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false))
  return {
    set(x, y) {
      if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) cells[y][x] = true
    },
    rect(x, y, w, h) {
      for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j)
    },
    cells
  }
}

function toSvg(g) {
  const rects = []
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (g.cells[y][x]) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#000001"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.join('')}</svg>\n`
}

function writeAnim(id, meta, frames) {
  const dir = join(root, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'anim.json'), `${JSON.stringify({ ...meta, fps: meta.fps, size: SIZE }, null, 2)}\n`)
  frames.forEach((frame, index) => {
    writeFileSync(join(dir, `${String(index).padStart(2, '0')}.svg`), toSvg(frame))
  })
}

function spinner() {
  const spots = [
    [13, 7],
    [12, 4],
    [8, 2],
    [4, 4],
    [2, 7],
    [4, 10],
    [8, 12],
    [12, 10]
  ]
  return spots.map((_, offset) => {
    const g = grid()
    for (let i = 0; i < 3; i += 1) {
      const [x, y] = spots[(offset + i) % spots.length]
      g.rect(x, y, 2, 2)
    }
    return g
  })
}

function dots() {
  const xs = [3, 7, 11]
  return [0, 1, 2].map((lit) => {
    const g = grid()
    xs.forEach((x, index) => {
      if (index === lit) g.rect(x, 7, 2, 2)
      else g.rect(x + 1, 8, 1, 1)
    })
    return g
  })
}

function wifi() {
  return [0, 1, 2, 3].map((level) => {
    const g = grid()
    g.rect(7, 12, 2, 2)
    if (level >= 1) {
      g.rect(5, 10, 6, 1)
      g.set(4, 11)
      g.set(11, 11)
    }
    if (level >= 2) {
      g.rect(4, 7, 8, 1)
      g.set(3, 8)
      g.set(12, 8)
    }
    if (level >= 3) {
      g.rect(3, 4, 10, 1)
      g.set(2, 5)
      g.set(13, 5)
    }
    return g
  })
}

function battery() {
  return [0, 1, 2, 3, 4].map((level) => {
    const g = grid()
    g.rect(1, 5, 13, 1)
    g.rect(1, 10, 13, 1)
    g.rect(1, 6, 1, 4)
    g.rect(13, 6, 1, 4)
    g.rect(14, 7, 1, 2)
    for (let n = 0; n < level; n += 1) g.rect(3 + n * 2, 7, 2, 2)
    return g
  })
}

function heart() {
  const small = [
    [5, 4],
    [6, 4],
    [9, 4],
    [10, 4],
    [4, 5],
    [5, 5],
    [6, 5],
    [7, 5],
    [8, 5],
    [9, 5],
    [10, 5],
    [11, 5],
    [4, 6],
    [5, 6],
    [6, 6],
    [7, 6],
    [8, 6],
    [9, 6],
    [10, 6],
    [11, 6],
    [5, 7],
    [6, 7],
    [7, 7],
    [8, 7],
    [9, 7],
    [10, 7],
    [6, 8],
    [7, 8],
    [8, 8],
    [9, 8],
    [7, 9],
    [8, 9]
  ]
  const big = [
    [4, 3],
    [5, 3],
    [6, 3],
    [9, 3],
    [10, 3],
    [11, 3],
    [3, 4],
    [4, 4],
    [5, 4],
    [6, 4],
    [7, 4],
    [8, 4],
    [9, 4],
    [10, 4],
    [11, 4],
    [12, 4],
    [3, 5],
    [4, 5],
    [5, 5],
    [6, 5],
    [7, 5],
    [8, 5],
    [9, 5],
    [10, 5],
    [11, 5],
    [12, 5],
    [4, 6],
    [5, 6],
    [6, 6],
    [7, 6],
    [8, 6],
    [9, 6],
    [10, 6],
    [11, 6],
    [5, 7],
    [6, 7],
    [7, 7],
    [8, 7],
    [9, 7],
    [10, 7],
    [6, 8],
    [7, 8],
    [8, 8],
    [9, 8],
    [7, 9],
    [8, 9]
  ]
  return [small, big].map((pixels) => {
    const g = grid()
    for (const [x, y] of pixels) g.set(x, y)
    return g
  })
}

function hourglass() {
  return [0, 1, 2, 3].map((step) => {
    const g = grid()
    g.rect(4, 2, 8, 1)
    g.rect(4, 13, 8, 1)
    g.rect(4, 3, 1, 2)
    g.rect(11, 3, 1, 2)
    g.rect(5, 5, 1, 1)
    g.rect(10, 5, 1, 1)
    g.rect(6, 6, 4, 1)
    g.rect(7, 7, 2, 2)
    g.rect(6, 9, 4, 1)
    g.rect(5, 10, 1, 1)
    g.rect(10, 10, 1, 1)
    g.rect(4, 11, 1, 2)
    g.rect(11, 11, 1, 2)
    if (step === 0) g.rect(6, 3, 4, 2)
    if (step === 1) {
      g.rect(6, 3, 4, 1)
      g.set(7, 6)
      g.rect(6, 12, 4, 1)
    }
    if (step === 2) {
      g.set(8, 8)
      g.rect(6, 11, 4, 2)
    }
    if (step === 3) g.rect(6, 11, 4, 2)
    return g
  })
}

function progress() {
  return [0, 1, 2, 3].map((step) => {
    const g = grid()
    g.rect(1, 6, 14, 1)
    g.rect(1, 9, 14, 1)
    g.rect(1, 7, 1, 2)
    g.rect(14, 7, 1, 2)
    g.rect(3, 7, step * 3, 2)
    return g
  })
}

function blink() {
  const open = grid()
  open.rect(3, 6, 10, 1)
  open.rect(2, 7, 12, 2)
  open.rect(3, 9, 10, 1)
  open.rect(6, 7, 4, 2)
  open.rect(7, 8, 1, 1)
  const shut = grid()
  shut.rect(3, 8, 10, 1)
  return [open, shut]
}

function pulse() {
  return [1, 2, 3, 4].map((r) => {
    const g = grid()
    const c = 7
    for (let x = c - r; x <= c + r; x += 1) {
      g.set(x, c - r)
      g.set(x, c + r)
    }
    for (let y = c - r; y <= c + r; y += 1) {
      g.set(c - r, y)
      g.set(c + r, y)
    }
    g.rect(7, 7, 2, 2)
    return g
  })
}

function signal() {
  return [1, 2, 3, 4].map((bars) => {
    const g = grid()
    for (let n = 0; n < bars; n += 1) g.rect(2 + n * 3, 12 - (n + 1) * 2, 2, (n + 1) * 2)
    return g
  })
}

function download() {
  return [0, 1, 2, 3].map((step) => {
    const g = grid()
    g.rect(3, 13, 10, 1)
    g.rect(3, 11, 1, 2)
    g.rect(12, 11, 1, 2)
    const y = 2 + step * 2
    g.rect(7, y, 2, 4)
    g.rect(5, y + 3, 6, 1)
    g.rect(6, y + 4, 4, 1)
    g.rect(7, y + 5, 2, 1)
    return g
  })
}

const anims = [
  { id: 'spinner', fps: 8, name: { tr: 'Yükleniyor', en: 'Loading' }, frames: spinner() },
  { id: 'dots', fps: 4, name: { tr: 'Noktalar', en: 'Dots' }, frames: dots() },
  { id: 'wifi', fps: 3, name: { tr: 'Wi-Fi', en: 'Wi-Fi' }, frames: wifi() },
  { id: 'battery', fps: 3, name: { tr: 'Pil', en: 'Battery' }, frames: battery() },
  { id: 'heart', fps: 3, name: { tr: 'Kalp', en: 'Heart' }, frames: heart() },
  { id: 'hourglass', fps: 3, name: { tr: 'Kum saati', en: 'Hourglass' }, frames: hourglass() },
  { id: 'progress', fps: 3, name: { tr: 'İlerleme', en: 'Progress' }, frames: progress() },
  { id: 'blink', fps: 2, name: { tr: 'Göz kırp', en: 'Blink' }, frames: blink() },
  { id: 'pulse', fps: 4, name: { tr: 'Nabız', en: 'Pulse' }, frames: pulse() },
  { id: 'signal', fps: 3, name: { tr: 'Sinyal', en: 'Signal' }, frames: signal() },
  { id: 'download', fps: 4, name: { tr: 'İndir', en: 'Download' }, frames: download() }
]

for (const anim of anims) {
  writeAnim(anim.id, { name: anim.name, fps: anim.fps }, anim.frames)
}

console.log(`Wrote ${anims.length} pixel animations into gallery/animations`)
