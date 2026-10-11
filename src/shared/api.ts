export type ThemePreference = 'system' | 'dark' | 'light'
export type ResolvedTheme = 'dark' | 'light'
export type Locale = 'tr' | 'en'

export interface AppSettings {
  theme: ThemePreference
  locale: Locale
  recents: string[]
  projectsDir: string | null
  setupComplete: boolean
}

export interface SetupState {
  setupComplete: boolean
  projectsDir: string
  defaultProjectsDir: string
  desktopShortcutSupported: boolean
}

export interface SetupInput {
  projectsDir: string
  desktopShortcut: boolean
}

export interface AppInfo {
  name: string
  version: string
}

export interface OpenedProject {
  path: string
  contents: string
}

export type IpcErrorCode = 'cancelled' | 'too_large' | 'unreadable' | 'write_failed' | 'invalid'

export class IpcRequestError extends Error {
  readonly code: IpcErrorCode

  constructor(code: IpcErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'IpcRequestError'
  }
}

export interface IvecDesktopApi {
  getAppInfo: () => Promise<AppInfo>
  getSettings: () => Promise<AppSettings>
  getSetupState: () => Promise<SetupState>
  completeSetup: (input: SetupInput) => Promise<{ recents: string[] }>
  pickProjectsDir: () => Promise<string | null>
  setTheme: (theme: ThemePreference) => Promise<ResolvedTheme>
  setLocale: (locale: Locale) => Promise<void>
  getResolvedTheme: () => Promise<ResolvedTheme>
  onThemeChange: (listener: (theme: ResolvedTheme) => void) => () => void
  openProjectDialog: () => Promise<OpenedProject | null>
  saveProjectDialog: (suggestedName: string) => Promise<string | null>
  createLibraryProject: (suggestedName: string, contents: string) => Promise<{ path: string; recents: string[] }>
  listLibraryProjects: () => Promise<string[]>
  deleteLibraryProject: (filePath: string) => Promise<string[]>
  writeProject: (filePath: string, contents: string, renameTo?: string) => Promise<{ path: string; recents: string[] }>
  saveHeaderFile: (suggestedName: string, contents: string) => Promise<string | null>
  saveHeaderFolder: (files: { name: string; contents: string }[]) => Promise<string[] | null>
  rememberRecent: (filePath: string) => Promise<string[]>
  openRecent: (filePath: string) => Promise<OpenedProject>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
}

export const IPC = {
  getAppInfo: 'app:getInfo',
  getSettings: 'app:getSettings',
  getSetupState: 'app:getSetupState',
  completeSetup: 'app:completeSetup',
  pickProjectsDir: 'app:pickProjectsDir',
  setTheme: 'app:setTheme',
  setLocale: 'app:setLocale',
  getResolvedTheme: 'app:getResolvedTheme',
  themeChanged: 'app:themeChanged',
  openProjectDialog: 'project:openDialog',
  saveProjectDialog: 'project:saveDialog',
  createLibraryProject: 'project:createLibrary',
  listLibraryProjects: 'project:listLibrary',
  deleteLibraryProject: 'project:deleteLibrary',
  writeProject: 'project:write',
  saveHeaderFile: 'header:saveFile',
  saveHeaderFolder: 'header:saveFolder',
  rememberRecent: 'project:rememberRecent',
  openRecent: 'project:openRecent',
  windowMinimize: 'window:minimize',
  windowMaximize: 'window:maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:isMaximized'
} as const

export const PROJECT_FILE_MAX_BYTES = 8 * 1024 * 1024
