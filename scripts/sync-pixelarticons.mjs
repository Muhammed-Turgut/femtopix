#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(root, '.tmp-pixel-icons')
const version = process.argv[2] || '2.4.1'
const dest = join(root, 'gallery', 'pixelart')

rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
execSync(`npm pack pixelarticons@${version} --pack-destination "${tmp}"`, { stdio: 'inherit' })
execSync(`tar -xzf "${join(tmp, `pixelarticons-${version}.tgz`)}" -C "${tmp}"`)
mkdirSync(dest, { recursive: true })
execSync(`rm -f "${dest}"/*.svg`)
cpSync(join(tmp, 'package', 'svg'), dest, { recursive: true })
writeFileSync(
  join(dest, 'category.json'),
  `${JSON.stringify({ name: { tr: 'Pixelart', en: 'Pixelart' }, order: 5 }, null, 2)}\n`
)
rmSync(tmp, { recursive: true, force: true })
console.log(`Copied pixelarticons@${version} into gallery/pixelart`)
