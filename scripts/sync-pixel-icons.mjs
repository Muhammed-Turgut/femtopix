#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(root, '.tmp-pixel-icons')
const version = process.argv[2] || '1.1.0'
const pack = `@hackernoon/pixel-icon-library@${version}`

const folders = [
  { from: 'regular', id: 'pixel', name: { tr: 'Pixel', en: 'Pixel' }, order: 1 },
  { from: 'solid', id: 'pixel-solid', name: { tr: 'Pixel dolu', en: 'Pixel solid' }, order: 2 },
  { from: 'brands', id: 'pixel-brands', name: { tr: 'Pixel markalar', en: 'Pixel brands' }, order: 3 },
  { from: 'purcats', id: 'pixel-topics', name: { tr: 'Pixel konular', en: 'Pixel topics' }, order: 4 }
]

rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
execSync(`npm pack ${pack} --pack-destination "${tmp}"`, { stdio: 'inherit' })
execSync(`tar -xzf "${join(tmp, `hackernoon-pixel-icon-library-${version}.tgz`)}" -C "${tmp}"`)

const srcRoot = join(tmp, 'package', 'icons', 'SVG')
for (const folder of folders) {
  const dest = join(root, 'gallery', folder.id)
  mkdirSync(dest, { recursive: true })
  execSync(`rm -f "${dest}"/*.svg`)
  cpSync(join(srcRoot, folder.from), dest, { recursive: true })
  writeFileSync(
    join(dest, 'category.json'),
    `${JSON.stringify({ name: folder.name, order: folder.order }, null, 2)}\n`
  )
}

writeFileSync(
  join(root, 'gallery', 'NOTICE'),
  `HackerNoon Pixel Icon Library ${version}
https://www.npmjs.com/package/@hackernoon/pixel-icon-library
https://pixeliconlibrary.com

Icon SVG files are Copyright (c) HackerNoon and licensed under CC BY 4.0
https://creativecommons.org/licenses/by/4.0/

No modifications were made to the SVG artwork; files were copied into gallery/
as bundled icons. Give credit to HackerNoon / Pixel Icon Library when you
redistribute these icons.
`
)

rmSync(tmp, { recursive: true, force: true })
console.log(`Copied ${pack} SVG icons into gallery/pixel*`)
