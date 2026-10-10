import { contextBridge, ipcRenderer } from 'electron'
import type { IvecDesktopApi, Locale, ResolvedTheme, ThemePreference } from '../../src/shared/api'
import { IPC } from '../../src/shared/api'

const api: IvecDesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setTheme: (theme: ThemePreference) => ipcRenderer.invoke(IPC.setTheme, theme),
  setLocale: (locale: Locale) => ipcRenderer.invoke(IPC.setLocale, locale),
  getResolvedTheme: () => ipcRenderer.invoke(IPC.getResolvedTheme),
  onThemeChange: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, theme: ResolvedTheme) => listener(theme)
    ipcRenderer.on(IPC.themeChanged, wrapped)
    return () => ipcRenderer.removeListener(IPC.themeChanged, wrapped)
  },
  openProjectDialog: () => ipcRenderer.invoke(IPC.openProjectDialog),
  saveProjectDialog: (suggestedName: string) => ipcRenderer.invoke(IPC.saveProjectDialog, suggestedName),
  createLibraryProject: (suggestedName, contents) => ipcRenderer.invoke(IPC.createLibraryProject, suggestedName, contents),
  listLibraryProjects: () => ipcRenderer.invoke(IPC.listLibraryProjects),
  writeProject: (filePath, contents) => ipcRenderer.invoke(IPC.writeProject, filePath, contents),
  rememberRecent: (filePath) => ipcRenderer.invoke(IPC.rememberRecent, filePath),
  openRecent: (filePath) => ipcRenderer.invoke(IPC.openRecent, filePath)
}

contextBridge.exposeInMainWorld('ivec', api)

for (const detail of ['new', 'open', 'save', 'cycleTheme', 'undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'] as const) {
  ipcRenderer.on(`menu:${detail}`, () => window.dispatchEvent(new CustomEvent('ivec:menu', { detail })))
}
