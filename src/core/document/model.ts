import { z } from 'zod'
import { getProfile } from '@/core/devices/profiles'
import { normalizeTextNodes } from '@/core/fonts/bitmap-font'

export const APP_VERSION = '0.1.0'

export type ColorMode = 'mono' | 'gray2' | 'gray4' | 'rgb565' | 'rgb888'
export type ExportTarget =
  | 'u8g2'
  | 'adafruit_gfx'
  | 'tft_espi'
  | 'arduino_gfx'
  | 'lvgl'
  | 'flipper'
  | 'raw'
export type NodeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'triangle'
  | 'text'
  | 'image'
  | 'paint'
  | 'group'
  | 'instance'
  | 'point'
  | 'arc'

export interface PreviewColors {
  pixelOn: string
  pixelOff: string
  bezel?: string
}

export interface DocumentMeta {
  name: string
  created: string
  modified: string
  app: string
}

export interface DeviceSettings {
  profile: string
  width: number
  height: number
  colorMode: ColorMode
  library: ExportTarget
  preview: PreviewColors
}

export interface SceneNode {
  id: string
  type: NodeType
  name: string
  x: number
  y: number
  w?: number
  h?: number
  visible: boolean
  locked: boolean
  color: number | string
  strokeColor?: number | string
  role?: 'normal' | 'reference'
  vars?: Record<string, string>
  children?: SceneNode[]
  text?: string
  font?: string
  fill?: boolean
  stroke?: number
  radius?: number
  asset?: string
  frames?: string[]
  fps?: number
  opacity?: number
  flipX?: boolean
  flipY?: boolean
  points?: { x: number; y: number }[]
}

export interface Screen {
  id: string
  name: string
  cIdentifier: string
  x: number
  y: number
  userCode: { prefix: string; suffix: string }
  children: SceneNode[]
}

export interface IvecDocument {
  format: 'ivec'
  version: 1
  meta: DocumentMeta
  device: DeviceSettings
  fonts: unknown[]
  assets: unknown[]
  components: unknown[]
  screens: Screen[]
  loose: SceneNode[]
  export: {
    activeTarget: ExportTarget
    common: {
      comments: boolean
      naming: { screenFn: string; imagePrefix: string; fontPrefix: string }
    }
    targets: Record<string, Record<string, unknown>>
  }
  ui: { zoom: number; pan: [number, number]; grid: boolean }
}

const nodeSchema: z.ZodType<SceneNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum([
      'rect',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'triangle',
      'text',
      'image',
      'paint',
      'group',
      'instance',
      'point',
      'arc'
    ]),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number().optional(),
    h: z.number().optional(),
    visible: z.boolean(),
    locked: z.boolean(),
    color: z.union([z.number(), z.string()]),
    strokeColor: z.union([z.number(), z.string()]).optional(),
    role: z.enum(['normal', 'reference']).optional(),
    vars: z.record(z.string()).optional(),
    children: z.array(nodeSchema).optional(),
    text: z.string().optional(),
    font: z.string().optional(),
    fill: z.boolean().optional(),
    stroke: z.number().optional(),
    radius: z.number().optional(),
    asset: z.string().optional(),
    frames: z.array(z.string()).optional(),
    fps: z.number().optional(),
    opacity: z.number().optional(),
    flipX: z.boolean().optional(),
    flipY: z.boolean().optional(),
    points: z.array(z.object({ x: z.number(), y: z.number() })).optional()
  })
)

const documentSchema = z.object({
  format: z.literal('ivec'),
  version: z.literal(1),
  meta: z.object({
    name: z.string(),
    created: z.string(),
    modified: z.string(),
    app: z.string()
  }),
  device: z.object({
    profile: z.string(),
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
    colorMode: z.enum(['mono', 'gray2', 'gray4', 'rgb565', 'rgb888']),
    library: z.enum(['u8g2', 'adafruit_gfx', 'tft_espi', 'arduino_gfx', 'lvgl', 'flipper', 'raw']),
    preview: z.object({
      pixelOn: z.string(),
      pixelOff: z.string(),
      bezel: z.string().optional()
    })
  }),
  fonts: z.array(z.unknown()).default([]),
  assets: z.array(z.unknown()).default([]),
  components: z.array(z.unknown()).default([]),
  screens: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        cIdentifier: z.string(),
        x: z.number(),
        y: z.number(),
        userCode: z.object({ prefix: z.string(), suffix: z.string() }).default({ prefix: '', suffix: '' }),
        children: z.array(nodeSchema).default([])
      })
    )
    .min(1),
  loose: z.array(nodeSchema).default([]),
  export: z.object({
    activeTarget: z.enum(['u8g2', 'adafruit_gfx', 'tft_espi', 'arduino_gfx', 'lvgl', 'flipper', 'raw']),
    common: z.object({
      comments: z.boolean(),
      naming: z.object({
        screenFn: z.string(),
        imagePrefix: z.string(),
        fontPrefix: z.string()
      })
    }),
    targets: z.record(z.record(z.unknown()))
  }),
  ui: z.object({
    zoom: z.number(),
    pan: z.tuple([z.number(), z.number()]),
    grid: z.boolean()
  })
})

const TRANSLIT: Record<string, string> = {
  ç: 'c',
  Ç: 'C',
  ğ: 'g',
  Ğ: 'G',
  ı: 'i',
  İ: 'I',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U'
}

const RESERVED = new Set([
  'int',
  'char',
  'class',
  'default',
  'return',
  'void',
  'const',
  'static',
  'struct',
  'enum',
  'high',
  'low',
  'input',
  'output',
  'true',
  'false',
  'bool',
  'if',
  'else',
  'for',
  'while'
])

export function toCIdentifier(raw: string, used = new Set<string>()): string {
  let next = raw
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!next) next = 'screen'
  if (/^[0-9]/.test(next)) next = `_${next}`
  if (RESERVED.has(next.toLowerCase())) next = `${next}_`

  let candidate = next.toLowerCase()
  let index = 2
  while (used.has(candidate)) {
    candidate = `${next.toLowerCase()}_${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createEmptyDocument(options: {
  name: string
  profileId: string
  width?: number
  height?: number
  library?: ExportTarget
}): IvecDocument {
  const profile = getProfile(options.profileId)
  const width = options.width ?? profile.width
  const height = options.height ?? profile.height
  const library = options.library ?? profile.defaultLibrary
  const created = nowIso()
  const used = new Set<string>()

  return {
    format: 'ivec',
    version: 1,
    meta: {
      name: options.name.trim() || 'untitled',
      created,
      modified: created,
      app: `femtopix ${APP_VERSION}`
    },
    device: {
      profile: profile.id,
      width,
      height,
      colorMode: profile.colorMode,
      library,
      preview: { ...profile.preview }
    },
    fonts: [],
    assets: [],
    components: [],
    screens: [
      {
        id: 's1',
        name: 'Screen 1',
        cIdentifier: toCIdentifier('Screen 1', used),
        x: 0,
        y: 0,
        userCode: { prefix: '', suffix: '' },
        children: []
      }
    ],
    loose: [],
    export: {
      activeTarget: library,
      common: {
        comments: true,
        naming: {
          screenFn: 'draw_{screen}',
          imagePrefix: 'image_',
          fontPrefix: 'font_'
        }
      },
      targets: {
        u8g2: {
          wrapperFunction: true,
          includeFonts: true,
          declareImages: true,
          includeImageFiles: true,
          declareVariables: true,
          clearDisplay: true,
          progmem: true,
          syntax: 'arduino',
          bufferMode: 'full',
          fontSubset: 'used'
        },
        adafruit_gfx: {
          wrapperFunction: true,
          declareImages: true,
          declareVariables: true,
          clearDisplay: true,
          progmem: true
        }
      }
    },
    ui: { zoom: 6, pan: [0, 0], grid: true }
  }
}

export function parseDocument(raw: string): IvecDocument {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('invalid_json')
  }
  const parsed = documentSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('invalid_schema')
  }
  for (const screen of parsed.data.screens) normalizeTextNodes(screen.children, parsed.data.device.library)
  return parsed.data
}

export function serializeDocument(document: IvecDocument): string {
  return `${JSON.stringify({ ...document, meta: { ...document.meta, modified: nowIso() } }, null, 2)}\n`
}

export { generateCode as placeholderCode } from '@/core/export/generate-code'
