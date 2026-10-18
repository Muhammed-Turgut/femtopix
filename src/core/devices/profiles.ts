import type { ColorMode, ExportTarget, PreviewColors } from '@/core/document/model'

export interface DeviceProfile {
  id: string
  name: string
  width: number
  height: number
  colorMode: ColorMode
  shape: 'rect' | 'round'
  libraries: ExportTarget[]
  defaultLibrary: ExportTarget
  preview: PreviewColors
  rotation: 0 | 90 | 180 | 270
  colOffset: number
  rowOffset: number
  group: 'oled' | 'tft' | 'epaper' | 'other' | 'custom'
  available: boolean
}

export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: 'ssd1306-128x64',
    name: 'SSD1306',
    width: 128,
    height: 64,
    colorMode: 'mono',
    shape: 'rect',
    libraries: ['u8g2', 'adafruit_gfx'],
    defaultLibrary: 'u8g2',
    preview: { pixelOn: '#FFFFFF', pixelOff: '#000000', bezel: 'oled-green' },
    rotation: 0,
    colOffset: 0,
    rowOffset: 0,
    group: 'oled',
    available: true
  },
  {
    id: 'ssd1306-128x32',
    name: 'SSD1306',
    width: 128,
    height: 32,
    colorMode: 'mono',
    shape: 'rect',
    libraries: ['u8g2', 'adafruit_gfx'],
    defaultLibrary: 'u8g2',
    preview: { pixelOn: '#FFFFFF', pixelOff: '#000000', bezel: 'oled-green' },
    rotation: 0,
    colOffset: 0,
    rowOffset: 0,
    group: 'oled',
    available: true
  },
  {
    id: 'sh1106-128x64',
    name: 'SH1106',
    width: 128,
    height: 64,
    colorMode: 'mono',
    shape: 'rect',
    libraries: ['u8g2', 'adafruit_gfx'],
    defaultLibrary: 'u8g2',
    preview: { pixelOn: '#FFFFFF', pixelOff: '#000000', bezel: 'oled-green' },
    rotation: 0,
    colOffset: 2,
    rowOffset: 0,
    group: 'oled',
    available: true
  },
  {
    id: 'ssd1306-64x48',
    name: 'SSD1306',
    width: 64,
    height: 48,
    colorMode: 'mono',
    shape: 'rect',
    libraries: ['u8g2', 'adafruit_gfx'],
    defaultLibrary: 'u8g2',
    preview: { pixelOn: '#FFFFFF', pixelOff: '#000000', bezel: 'oled-white' },
    rotation: 0,
    colOffset: 0,
    rowOffset: 0,
    group: 'oled',
    available: true
  },
  {
    id: 'flipper-128x64',
    name: 'Flipper Zero',
    width: 128,
    height: 64,
    colorMode: 'mono',
    shape: 'rect',
    libraries: ['flipper'],
    defaultLibrary: 'flipper',
    preview: { pixelOn: '#FF8A3D', pixelOff: '#000000', bezel: 'flipper' },
    rotation: 0,
    colOffset: 0,
    rowOffset: 0,
    group: 'other',
    available: false
  },
  {
    id: 'st7789-240x240',
    name: 'ST7789',
    width: 240,
    height: 240,
    colorMode: 'rgb565',
    shape: 'rect',
    libraries: ['tft_espi', 'arduino_gfx'],
    defaultLibrary: 'tft_espi',
    preview: { pixelOn: '#FFFFFF', pixelOff: '#000000', bezel: 'tft' },
    rotation: 0,
    colOffset: 0,
    rowOffset: 0,
    group: 'tft',
    available: true
  },
  {
    id: 'custom',
    name: 'Custom',
    width: 128,
    height: 64,
    colorMode: 'mono',
    shape: 'rect',
    libraries: ['u8g2', 'adafruit_gfx'],
    defaultLibrary: 'u8g2',
    preview: { pixelOn: '#FFFFFF', pixelOff: '#000000', bezel: 'oled-white' },
    rotation: 0,
    colOffset: 0,
    rowOffset: 0,
    group: 'custom',
    available: true
  }
]

export function getProfile(id: string): DeviceProfile {
  return DEVICE_PROFILES.find((profile) => profile.id === id) ?? DEVICE_PROFILES[0]
}

export function listSelectableProfiles(): DeviceProfile[] {
  return DEVICE_PROFILES.filter((profile) => profile.available)
}
