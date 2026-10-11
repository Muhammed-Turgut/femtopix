import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { BrowserWindow, Menu, app, dialog, ipcMain, nativeTheme, screen, type MenuItemConstructorOptions } from 'electron'
import type { AppSettings, Locale, ResolvedTheme, ThemePreference } from '../../src/shared/api'
import { IPC, PROJECT_FILE_MAX_BYTES } from '../../src/shared/api'
import { nextAvailableIvecName } from '../../src/shared/project-file'

app.setName('femtopix')

const SETTINGS_DEFAULTS: AppSettings = {
  theme: 'system',
  locale: 'tr',
  recents: []
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<AppSettings>
    return {
      theme: raw.theme ?? SETTINGS_DEFAULTS.theme,
      locale: raw.locale ?? SETTINGS_DEFAULTS.locale,
      recents: Array.isArray(raw.recents) ? raw.recents.filter((item) => typeof item === 'string') : []
    }
  } catch {
    return { ...SETTINGS_DEFAULTS }
  }
}

function writeSettings(next: AppSettings): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  nativeTheme.themeSource = preference
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function rememberRecent(filePath: string): string[] {
  const settings = readSettings()
  const recents = [filePath, ...settings.recents.filter((item) => item !== filePath)].slice(0, 12)
  writeSettings({ ...settings, recents })
  return recents
}

function projectsDir(): string {
  return join(app.getPath('userData'), 'projects')
}

function isInside(root: string, filePath: string): boolean {
  const base = resolve(root)
  const resolved = resolve(filePath)
  return resolved === base || resolved.startsWith(`${base}${sep}`)
}

function writeProjectFile(filePath: string, contents: string): void {
  if (Buffer.byteLength(contents, 'utf8') > PROJECT_FILE_MAX_BYTES) {
    throw new Error('too_large')
  }
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  writeFileSync(tmp, contents, 'utf8')
  try {
    renameSync(tmp, filePath)
  } catch {
    writeFileSync(filePath, contents, 'utf8')
    if (existsSync(tmp)) unlinkSync(tmp)
  }
}

function listLibraryPaths(): string[] {
  const dir = projectsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.ivec'))
    .map((name) => {
      const filePath = join(dir, name)
      return { filePath, mtime: statSync(filePath).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map((item) => item.filePath)
}

function canWriteProject(filePath: string): boolean {
  const resolved = resolve(filePath)
  if (isInside(projectsDir(), resolved)) return true
  return readSettings().recents.some((item) => resolve(item) === resolved)
}

function canReadProject(filePath: string): boolean {
  return canWriteProject(filePath)
}

function preloadPath(): string {
  const candidates = [
    join(__dirname, '../preload/index.mjs'),
    join(__dirname, '../preload/index.cjs'),
    join(__dirname, '../preload/index.js')
  ]
  return candidates.find((file) => existsSync(file)) ?? candidates[0]
}

function createWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const win = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(920, height),
    minWidth: 1100,
    minHeight: 720,
    title: 'femtopix',
    backgroundColor: '#171329',
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../electron/resources/icon.png'),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => win.show())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'femtopix',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Dosya',
      submenu: [
        { label: 'Yeni proje', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new') },
        { label: 'Aç…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open') },
        { label: 'Kaydet', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { label: 'Geri al', accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
        { label: 'Yinele', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('menu:redo') },
        { label: 'Yinele', accelerator: 'CmdOrCtrl+Y', click: () => send('menu:redo') },
        { type: 'separator' },
        { label: 'Kes', accelerator: 'CmdOrCtrl+X', click: () => send('menu:cut') },
        { label: 'Kopyala', accelerator: 'CmdOrCtrl+C', click: () => send('menu:copy') },
        { label: 'Yapıştır', accelerator: 'CmdOrCtrl+V', click: () => send('menu:paste') },
        { label: 'Tümünü seç', accelerator: 'CmdOrCtrl+A', click: () => send('menu:selectAll') }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Tema değiştir', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('menu:cycleTheme') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function send(channel: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel)
}

function registerIpc(): void {
  ipcMain.handle(IPC.getAppInfo, () => ({
    name: 'femtopix',
    version: app.getVersion()
  }))

  ipcMain.handle(IPC.getSettings, () => readSettings())

  ipcMain.handle(IPC.setTheme, (_event, theme: ThemePreference) => {
    const settings = { ...readSettings(), theme }
    writeSettings(settings)
    const resolved = applyTheme(theme)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.themeChanged, resolved)
    }
    return resolved
  })

  ipcMain.handle(IPC.setLocale, (_event, locale: Locale) => {
    writeSettings({ ...readSettings(), locale })
  })

  ipcMain.handle(IPC.getResolvedTheme, () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'))

  ipcMain.handle(IPC.openProjectDialog, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Proje aç',
      filters: [{ name: 'femtopix', extensions: ['ivec', 'json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const contents = readFileSync(filePath)
    if (contents.byteLength > PROJECT_FILE_MAX_BYTES) {
      throw new Error('too_large')
    }
    rememberRecent(filePath)
    return { path: filePath, contents: contents.toString('utf8') }
  })

  ipcMain.handle(IPC.saveProjectDialog, async (_event, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Projeyi kaydet',
      defaultPath: suggestedName.endsWith('.ivec') ? suggestedName : `${suggestedName}.ivec`,
      filters: [{ name: 'femtopix', extensions: ['ivec'] }]
    })
    return result.canceled || !result.filePath ? null : result.filePath
  })

  ipcMain.handle(IPC.createLibraryProject, (_event, suggestedName: string, contents: string) => {
    const dir = projectsDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const existing = readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.ivec'))
    const filePath = join(dir, nextAvailableIvecName(existing, suggestedName))
    writeProjectFile(filePath, contents)
    return { path: filePath, recents: rememberRecent(filePath) }
  })

  ipcMain.handle(IPC.listLibraryProjects, () => listLibraryPaths())

  ipcMain.handle(IPC.writeProject, (_event, filePath: string, contents: string) => {
    if (!canWriteProject(filePath)) throw new Error('unreadable')
    writeProjectFile(filePath, contents)
    rememberRecent(filePath)
  })

  ipcMain.handle(IPC.rememberRecent, (_event, filePath: string) => rememberRecent(filePath))

  ipcMain.handle(IPC.openRecent, (_event, filePath: string) => {
    if (!canReadProject(filePath)) throw new Error('unreadable')
    const contents = readFileSync(filePath)
    if (contents.byteLength > PROJECT_FILE_MAX_BYTES) throw new Error('too_large')
    rememberRecent(filePath)
    return { path: filePath, contents: contents.toString('utf8') }
  })
}

app.whenReady().then(() => {
  const settings = readSettings()
  applyTheme(settings.theme)
  registerIpc()
  buildMenu()
  createWindow()

  nativeTheme.on('updated', () => {
    const resolved: ResolvedTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.themeChanged, resolved)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
