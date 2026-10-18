import { describe, expect, it } from 'vitest'
import { createEmptyDocument, parseDocument, placeholderCode, serializeDocument, toCIdentifier } from '@/core/document/model'
import { nextAvailableIvecName, safeProjectStem } from '@/shared/project-file'
import { useAppStore } from '@/store/app-store'
import { headerFileName } from '@/shared/header-file'
import { addNode, createNode, duplicateScreen, isIconNode, removeScreen } from '@/ui/editor/document-actions'

describe('toCIdentifier', () => {
  it('transliterates Turkish characters and avoids reserved words', () => {
    expect(toCIdentifier('Şehir Menü')).toBe('sehir_menu')
    expect(toCIdentifier('class')).toBe('class_')
    expect(toCIdentifier('2home')).toBe('_2home')
    const used = new Set<string>()
    expect(toCIdentifier('Screen 1', used)).toBe('screen_1')
    expect(toCIdentifier('Screen 1', used)).toBe('screen_1_2')
  })
})

describe('document round-trip', () => {
  it('creates a valid empty SSD1306 project and parses it back', () => {
    const doc = createEmptyDocument({ name: 'gps-tracker', profileId: 'ssd1306-128x64' })
    expect(doc.device.width).toBe(128)
    expect(doc.device.height).toBe(64)
    expect(doc.device.library).toBe('u8g2')
    expect(doc.screens[0]?.cIdentifier).toBe('screen_1')
    const again = parseDocument(serializeDocument(doc))
    expect(again.meta.name).toBe('gps-tracker')
    expect(again.screens).toHaveLength(1)
    expect(again.folders).toEqual([])
  })

  it('keeps screen folders and drops a missing folder id', () => {
    const doc = createEmptyDocument({ name: 'gps-tracker', profileId: 'ssd1306-128x64' })
    doc.folders = [{ id: 'f1', name: 'Wifi', collapsed: true }]
    doc.screens[0]!.folderId = 'f1'
    const again = parseDocument(serializeDocument(doc))
    expect(again.folders[0]?.name).toBe('Wifi')
    expect(again.folders[0]?.collapsed).toBe(true)
    expect(again.screens[0]?.folderId).toBe('f1')
    doc.screens[0]!.folderId = 'missing'
    doc.folders = []
    const stripped = parseDocument(serializeDocument(doc))
    expect(stripped.screens[0]?.folderId).toBeUndefined()
  })

  it('emits rounded-rect calls when a rect has a corner radius', () => {
    const doc = createEmptyDocument({ name: 'oled', profileId: 'ssd1306-128x64' })
    doc.screens[0]?.children.push({
      id: 'r1',
      type: 'rect',
      name: 'card',
      x: 2,
      y: 4,
      w: 20,
      h: 12,
      visible: true,
      locked: false,
      color: 1,
      fill: true,
      radius: 3
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('u8g2.drawRBox(2, 4, 20, 12, 3);')
  })

  it('emits u8g2 calls for visible layers', () => {
    const doc = createEmptyDocument({ name: 'gps-tracker', profileId: 'ssd1306-128x64' })
    doc.screens[0]?.children.push({
      id: 'n1',
      type: 'rect',
      name: 'box',
      x: 4,
      y: 8,
      w: 16,
      h: 10,
      visible: true,
      locked: false,
      color: 1,
      fill: true
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('u8g2.drawBox(4, 8, 16, 10);')
    expect(code).not.toContain('Katmanlar buraya')
  })

  it('emits RGB565 literals for a color GFX target', () => {
    const doc = createEmptyDocument({ name: 'tft', profileId: 'st7789-240x240' })
    doc.device.colorMode = 'rgb565'
    doc.device.library = 'adafruit_gfx'
    doc.screens[0]?.children.push({
      id: 'n1',
      type: 'rect',
      name: 'box',
      x: 4,
      y: 8,
      w: 16,
      h: 10,
      visible: true,
      locked: false,
      color: '#FF0000',
      fill: true
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('d.fillRect(4, 8, 16, 10, 0xf800);')
  })

  it('emits separate RGB565 fill and stroke colors', () => {
    const doc = createEmptyDocument({ name: 'tft', profileId: 'st7789-240x240' })
    doc.device.colorMode = 'rgb565'
    doc.device.library = 'adafruit_gfx'
    doc.screens[0]?.children.push({
      id: 'n2',
      type: 'rect',
      name: 'frame',
      x: 2,
      y: 3,
      w: 20,
      h: 12,
      visible: true,
      locked: false,
      color: '#FF0000',
      strokeColor: '#0000FF',
      fill: true,
      stroke: 1
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('d.fillRect(2, 3, 20, 12, 0xf800);')
    expect(code).toContain('d.drawRect(2, 3, 20, 12, 0x001f);')
  })

  it('fits leftover space on stored text when the file is opened', () => {
    const doc = createEmptyDocument({ name: 'oled', profileId: 'ssd1306-128x64' })
    doc.screens[0]?.children.push({
      id: 't0',
      type: 'text',
      name: 'Metin',
      x: 0,
      y: 0,
      w: 40,
      h: 10,
      visible: true,
      locked: false,
      color: 1,
      text: 'Metin'
    })
    const again = parseDocument(serializeDocument(doc))
    const node = again.screens[0]?.children[0]
    expect(node?.w).toBe(30)
    expect(node?.h).toBe(10)
    expect(node?.font).toBe('6x10')
  })

  it('emits u8g2 drawStr from the text baseline', () => {
    const doc = createEmptyDocument({ name: 'oled', profileId: 'ssd1306-128x64' })
    doc.screens[0]?.children.push({
      id: 't1',
      type: 'text',
      name: 'label',
      x: 4,
      y: 6,
      w: 30,
      h: 10,
      visible: true,
      locked: false,
      color: 1,
      text: 'Metin',
      font: '6x10'
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('u8g2.setFont(u8g2_font_6x10_tr);')
    expect(code).not.toContain('setFontPosTop')
    expect(code).toContain('u8g2.drawStr(4, 14, "Metin");')
  })

  it('emits a millis frame index for animated images', () => {
    const doc = createEmptyDocument({ name: 'oled', profileId: 'ssd1306-128x64' })
    doc.screens[0]?.children.push({
      id: 'a1',
      type: 'image',
      name: 'spinner',
      x: 8,
      y: 8,
      w: 16,
      h: 16,
      visible: true,
      locked: false,
      color: 1,
      asset: 'data:image/svg+xml,0',
      frames: ['data:image/svg+xml,0', 'data:image/svg+xml,1', 'data:image/svg+xml,2'],
      fps: 8
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('#include "spinner.h"')
    expect(code).toContain('spinner_frames')
    expect(code).toContain('u8g2.drawXBMP(8, 8, 16, 16, spinner_frames[(millis() / 125) % 3]);')
  })

  it('emits GFX text size for a scaled 5x7 font', () => {
    const doc = createEmptyDocument({ name: 'tft', profileId: 'st7789-240x240' })
    doc.device.library = 'adafruit_gfx'
    doc.screens[0]?.children.push({
      id: 't2',
      type: 'text',
      name: 'label',
      x: 2,
      y: 4,
      w: 12,
      h: 16,
      visible: true,
      locked: false,
      color: 1,
      text: 'Hi',
      font: '5x7x2'
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('d.setTextSize(2);')
    expect(code).toContain('d.print("Hi");')
  })

  it('emits drawPixel calls for a paint stroke', () => {
    const doc = createEmptyDocument({ name: 'oled', profileId: 'ssd1306-128x64' })
    doc.screens[0]?.children.push({
      id: 'p1',
      type: 'paint',
      name: 'dots',
      x: 2,
      y: 3,
      w: 3,
      h: 1,
      visible: true,
      locked: false,
      color: 1,
      fill: false,
      stroke: 1,
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 }
      ]
    })
    const code = placeholderCode(doc, doc.screens[0]!)
    expect(code).toContain('u8g2.drawPixel(2, 3);')
    expect(code).toContain('u8g2.drawPixel(4, 3);')
    expect(code).not.toContain('u8g2.drawLine(2, 3')
  })

  it('rejects a file that is not ivec', () => {
    expect(() => parseDocument('{"hello":true}')).toThrow('invalid_schema')
    expect(() => parseDocument('{')).toThrow('invalid_json')
  })
})

describe('icon headers', () => {
  it('keeps only a .h file name', () => {
    expect(headerFileName('wifi.svg')).toBe('wifi.h')
    expect(headerFileName('../x/cloud')).toBe('cloud.h')
    expect(headerFileName('2home.h')).toBe('_2home.h')
  })

  it('exports images and paint as icons, not shapes', () => {
    expect(isIconNode(createNode('image', 'icon', { x: 0, y: 0, w: 16, h: 16 }))).toBe(true)
    expect(isIconNode(createNode('paint', 'dots', { x: 0, y: 0, w: 8, h: 8 }))).toBe(true)
    expect(isIconNode(createNode('rect', 'box', { x: 0, y: 0, w: 8, h: 8 }))).toBe(false)
    expect(isIconNode(createNode('text', 'label', { x: 0, y: 0, w: 12, h: 8 }))).toBe(false)
  })
})

describe('library file names', () => {
  it('keeps a unique .ivec name in the library folder', () => {
    expect(safeProjectStem('gps/tracker:v1')).toBe('gpstrackerv1')
    expect(nextAvailableIvecName([], 'Adsız')).toBe('Adsız.ivec')
    expect(nextAvailableIvecName(['Adsız.ivec'], 'Adsız')).toBe('Adsız-2.ivec')
  })
})

describe('edit history', () => {
  it('undoes and redoes adding a layer', () => {
    useAppStore.getState().createProject({ name: 't', profileId: 'ssd1306-128x64' })
    const screenId = useAppStore.getState().activeScreenId
    expect(screenId).toBeTruthy()
    addNode(screenId!, createNode('rect', 'box', { x: 1, y: 2, w: 3, h: 4 }))
    expect(useAppStore.getState().document?.screens[0]?.children).toHaveLength(1)
    useAppStore.getState().undo()
    expect(useAppStore.getState().document?.screens[0]?.children).toHaveLength(0)
    useAppStore.getState().redo()
    expect(useAppStore.getState().document?.screens[0]?.children).toHaveLength(1)
  })

  it('duplicates and deletes a screen', () => {
    useAppStore.getState().createProject({ name: 't', profileId: 'ssd1306-128x64' })
    const first = useAppStore.getState().activeScreenId
    expect(first).toBeTruthy()
    addNode(first!, createNode('rect', 'box', { x: 2, y: 3, w: 4, h: 5 }))
    const copyId = duplicateScreen(first!)
    const screens = useAppStore.getState().document?.screens ?? []
    expect(screens).toHaveLength(2)
    expect(copyId).toBeTruthy()
    expect(screens[1]?.children[0]?.id).not.toBe(screens[0]?.children[0]?.id)
    expect(screens[1]?.children[0]?.name).toBe('box')
    expect(removeScreen(first!)).toBe(true)
    expect(useAppStore.getState().document?.screens).toHaveLength(1)
    expect(removeScreen(useAppStore.getState().activeScreenId!)).toBe(false)
    expect(useAppStore.getState().document?.screens).toHaveLength(1)
  })
})
