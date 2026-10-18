import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { BrowserWindow, Menu, app, dialog, ipcMain, nativeTheme, screen, shell, type MenuItemConstructorOptions } from 'electron'
import type { AppSettings, Locale, ResolvedTheme, SetupInput, ThemePreference } from '../../src/shared/api'
import { IPC, PROJECT_FILE_MAX_BYTES } from '../../src/shared/api'
import { HEADER_FILE_MAX_BYTES, headerFileName } from '../../src/shared/header-file'
import { nextAvailableIvecName } from '../../src/shared/project-file'

app.setName('femtopix')

const SETTINGS_DEFAULTS: AppSettings = {
  theme: 'system',
  locale: 'tr',
  recents: [],
  projectsDir: null,
  setupComplete: false
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
      recents: Array.isArray(raw.recents) ? raw.recents.filter((item) => typeof item === 'string') : [],
      projectsDir: typeof raw.projectsDir === 'string' && raw.projectsDir.trim() ? raw.projectsDir : null,
      setupComplete: Boolean(raw.setupComplete)
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

function swapRecent(from: string, to: string): string[] {
  const settings = readSettings()
  const recents = [
    to,
    ...settings.recents.filter((item) => resolve(item) !== resolve(from) && resolve(item) !== resolve(to))
  ].slice(0, 12)
  writeSettings({ ...settings, recents })
  return recents
}

function renamedLibraryPath(current: string, suggestedName: string): string {
  if (!isInside(projectsDir(), current)) return current
  const dir = projectsDir()
  const existing = readdirSync(dir).filter((name) => {
    if (!name.toLowerCase().endsWith('.ivec')) return false
    return resolve(join(dir, name)) !== resolve(current)
  })
  return join(dir, nextAvailableIvecName(existing, suggestedName))
}

function defaultProjectsDir(): string {
  return join(app.getPath('documents'), 'femtopix')
}

function legacyProjectsDir(): string {
  return join(app.getPath('userData'), 'projects')
}

function isSafeProjectsDir(dir: string): boolean {
  const resolved = resolve(dir)
  if (!resolved || resolved.length < 4) return false
  if (/^[a-zA-Z]:[\\/]?$/.test(resolved)) return false
  if (resolved === '/' || resolved === '\\') return false
  if (isInside(app.getAppPath(), resolved)) return false
  return true
}

function projectsDir(): string {
  const custom = readSettings().projectsDir
  if (custom && isSafeProjectsDir(custom)) return resolve(custom)
  if (hasLegacyLibrary()) return legacyProjectsDir()
  return defaultProjectsDir()
}

function hasLegacyLibrary(): boolean {
  const dir = legacyProjectsDir()
  if (!existsSync(dir)) return false
  return readdirSync(dir).some((name) => name.toLowerCase().endsWith('.ivec'))
}

function isSetupComplete(): boolean {
  const settings = readSettings()
  if (settings.setupComplete || settings.projectsDir) return true
  if (settings.recents.length > 0) return true
  return hasLegacyLibrary()
}

function createDesktopShortcut(): boolean {
  if (!app.isPackaged || process.platform !== 'win32') return false
  const link = join(app.getPath('desktop'), 'femtopix.lnk')
  return shell.writeShortcutLink(link, {
    target: app.getPath('exe'),
    cwd: dirname(app.getPath('exe')),
    description: 'femtopix',
    appUserModelId: 'com.femtopix.app'
  })
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
    backgroundColor: '#1e1e1e',
    show: false,
    frame: false,
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
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const mod = input.control || input.meta
    if (!mod || input.alt) return
    const key = input.key.toLowerCase()
    const detail = key === 'y' || (key === 'z' && input.shift) ? 'redo' : key === 'z' ? 'undo' : null
    if (!detail) return
    event.preventDefault()
    win.webContents.send(`menu:${detail}`)
  })

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
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(channel)
}

function registerIpc(): void {
  ipcMain.handle(IPC.getAppInfo, () => ({
    name: 'femtopix',
    version: app.getVersion()
  }))

  ipcMain.handle(IPC.getSettings, () => readSettings())

  ipcMain.handle(IPC.getSetupState, () => {
    const settings = readSettings()
    return {
      setupComplete: isSetupComplete(),
      projectsDir: settings.projectsDir ?? defaultProjectsDir(),
      defaultProjectsDir: defaultProjectsDir(),
      desktopShortcutSupported: app.isPackaged && process.platform === 'win32'
    }
  })

  ipcMain.handle(IPC.pickProjectsDir, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Proje klasörü',
      defaultPath: projectsDir(),
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.completeSetup, (_event, input: SetupInput) => {
    const dir = resolve(String(input?.projectsDir ?? '').trim() || defaultProjectsDir())
    if (!isSafeProjectsDir(dir)) throw new Error('invalid')
    mkdirSync(dir, { recursive: true })
    writeSettings({
      ...readSettings(),
      projectsDir: dir,
      setupComplete: true
    })
    if (input?.desktopShortcut) createDesktopShortcut()
    return { recents: [...new Set([...listLibraryPaths(), ...readSettings().recents])] }
  })

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

  ipcMain.handle(IPC.deleteLibraryProject, (_event, filePath: string) => {
    if (!canWriteProject(filePath)) throw new Error('unreadable')
    const resolved = resolve(filePath)
    if (existsSync(resolved)) unlinkSync(resolved)
    const settings = readSettings()
    const recents = settings.recents.filter((item) => resolve(item) !== resolved)
    writeSettings({ ...settings, recents })
    return [...new Set([...listLibraryPaths(), ...recents])]
  })

  ipcMain.handle(IPC.saveHeaderFile, async (_event, suggestedName: string, contents: string) => {
    if (typeof contents !== 'string' || contents.length > HEADER_FILE_MAX_BYTES) throw new Error('too_large')
    const result = await dialog.showSaveDialog({
      title: 'İkonu kaydet',
      defaultPath: headerFileName(suggestedName),
      filters: [{ name: 'C header', extensions: ['h'] }]
    })
    if (result.canceled || !result.filePath) return null
    const filePath = result.filePath.toLowerCase().endsWith('.h') ? result.filePath : `${result.filePath}.h`
    writeFileSync(filePath, contents, 'utf8')
    return filePath
  })

  ipcMain.handle(IPC.saveHeaderFolder, async (_event, files: { name: string; contents: string }[]) => {
    if (!Array.isArray(files) || files.length === 0) return null
    if (files.some((file) => typeof file?.contents !== 'string' || file.contents.length > HEADER_FILE_MAX_BYTES)) {
      throw new Error('too_large')
    }
    const result = await dialog.showOpenDialog({
      title: 'İkon klasörü',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const dir = result.filePaths[0]
    const written: string[] = []
    const used = new Set<string>()
    for (const file of files) {
      let name = headerFileName(file.name)
      let index = 2
      while (used.has(name.toLowerCase()) || existsSync(join(dir, name))) {
        name = headerFileName(`${name.replace(/\.h$/i, '')}_${index}`)
        index += 1
      }
      used.add(name.toLowerCase())
      const target = join(dir, name)
      writeFileSync(target, file.contents, 'utf8')
      written.push(target)
    }
    return written
  })

  ipcMain.handle(IPC.writeProject, (_event, filePath: string, contents: string, renameTo?: string) => {
    if (!canWriteProject(filePath)) throw new Error('unreadable')
    const current = resolve(filePath)
    const next =
      typeof renameTo === 'string' && renameTo.trim() ? renamedLibraryPath(current, renameTo) : current
    writeProjectFile(next, contents)
    if (next !== current && existsSync(current)) unlinkSync(current)
    const recents = next === current ? rememberRecent(next) : swapRecent(current, next)
    return { path: next, recents }
  })

  ipcMain.handle(IPC.rememberRecent, (_event, filePath: string) => rememberRecent(filePath))

  ipcMain.handle(IPC.openRecent, (_event, filePath: string) => {
    if (!canReadProject(filePath)) throw new Error('unreadable')
    const contents = readFileSync(filePath)
    if (contents.byteLength > PROJECT_FILE_MAX_BYTES) throw new Error('too_large')
    rememberRecent(filePath)
    return { path: filePath, contents: contents.toString('utf8') }
  })

  ipcMain.handle(IPC.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle(IPC.windowMaximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle(IPC.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IPC.windowIsMaximized, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
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
