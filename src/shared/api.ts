export type ThemePreference = 'system' | 'dark' | 'light'
export type ResolvedTheme = 'dark' | 'light'
export type Locale = 'tr' | 'en'

export interface AppSettings {
  theme: ThemePreference
  locale: Locale
  recents: string[]
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
  setTheme: (theme: ThemePreference) => Promise<ResolvedTheme>
  setLocale: (locale: Locale) => Promise<void>
  getResolvedTheme: () => Promise<ResolvedTheme>
  onThemeChange: (listener: (theme: ResolvedTheme) => void) => () => void
  openProjectDialog: () => Promise<OpenedProject | null>
  saveProjectDialog: (suggestedName: string) => Promise<string | null>
  createLibraryProject: (suggestedName: string, contents: string) => Promise<{ path: string; recents: string[] }>
  listLibraryProjects: () => Promise<string[]>
  writeProject: (filePath: string, contents: string) => Promise<void>
  rememberRecent: (filePath: string) => Promise<string[]>
  openRecent: (filePath: string) => Promise<OpenedProject>
}

export const IPC = {
  getAppInfo: 'app:getInfo',
  getSettings: 'app:getSettings',
  setTheme: 'app:setTheme',
  setLocale: 'app:setLocale',
  getResolvedTheme: 'app:getResolvedTheme',
  themeChanged: 'app:themeChanged',
  openProjectDialog: 'project:openDialog',
  saveProjectDialog: 'project:saveDialog',
  createLibraryProject: 'project:createLibrary',
  listLibraryProjects: 'project:listLibrary',
  writeProject: 'project:write',
  rememberRecent: 'project:rememberRecent',
  openRecent: 'project:openRecent'
} as const

export const PROJECT_FILE_MAX_BYTES = 8 * 1024 * 1024
