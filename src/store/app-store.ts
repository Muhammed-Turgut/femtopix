import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createEmptyDocument, parseDocument, serializeDocument, toCIdentifier, type ExportTarget, type IvecDocument, type Screen } from '@/core/document/model'
import type { Locale, ResolvedTheme, ThemePreference } from '@/shared/api'

export type ToolId =
  | 'select'
  | 'hand'
  | 'image'
  | 'pencil'
  | 'eraser'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'triangle'
  | 'polygon'
  | 'arc'
  | 'point'
  | 'eyedropper'

export type LeftTab = 'layers' | 'screens' | 'assets' | 'components' | 'gallery'
export type Route = 'home' | 'editor'
export type BusyKind = 'creating' | 'opening' | null

interface Toast {
  id: number
  message: string
}

interface AppState {
  ready: boolean
  route: Route
  document: IvecDocument | null
  filePath: string | null
  dirty: boolean
  themePref: ThemePreference
  resolvedTheme: ResolvedTheme
  locale: Locale
  recents: string[]
  setupComplete: boolean
  projectsDir: string | null
  tool: ToolId
  leftTab: LeftTab
  activeScreenId: string | null
  selectedIds: string[]
  toast: Toast | null
  wizardOpen: boolean
  galleryOpen: boolean
  galleryAnchor: { x: number; y: number } | null
  busy: BusyKind
  past: IvecDocument[]
  future: IvecDocument[]
}

interface AppActions {
  hydrate: (payload: {
    themePref: ThemePreference
    resolvedTheme: ResolvedTheme
    locale: Locale
    recents: string[]
    setupComplete?: boolean
    projectsDir?: string | null
  }) => void
  finishSetup: (projectsDir: string, recents: string[]) => void
  setResolvedTheme: (theme: ResolvedTheme) => void
  setThemePref: (pref: ThemePreference) => void
  setLocale: (locale: Locale) => void
  cycleTheme: () => ThemePreference
  openWizard: (open: boolean) => void
  openGallery: (anchor?: { x: number; y: number } | null) => void
  closeGallery: () => void
  setBusy: (busy: BusyKind) => void
  setRecents: (recents: string[]) => void
  goHome: () => void
  createProject: (input: {
    name: string
    profileId: string
    width?: number
    height?: number
    library?: ExportTarget
  }) => void
  loadFromFile: (path: string, contents: string) => void
  markSaved: (path: string) => void
  setTool: (tool: ToolId) => void
  setLeftTab: (tab: LeftTab) => void
  setActiveScreen: (id: string | null) => void
  addScreen: () => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  nudgePan: (dx: number, dy: number) => void
  setView: (zoom: number, pan: [number, number]) => void
  moveScreen: (id: string, x: number, y: number, record?: boolean) => void
  toggleGrid: () => void
  showToast: (message: string) => void
  clearToast: () => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
}

let toastSeq = 1

const THEME_CYCLE: ThemePreference[] = ['system', 'dark', 'light']

export const useAppStore = create<AppState & AppActions>()(
  immer((set, get) => ({
    ready: false,
    route: 'home',
    document: null,
    filePath: null,
    dirty: false,
    themePref: 'system',
    resolvedTheme: 'dark',
    locale: 'tr',
    recents: [],
    setupComplete: true,
    projectsDir: null,
    tool: 'select',
    leftTab: 'layers',
    activeScreenId: null,
    selectedIds: [],
    toast: null,
    wizardOpen: false,
    galleryOpen: false,
    galleryAnchor: null,
    busy: null,
    past: [],
    future: [],

    hydrate: (payload) =>
      set((state) => {
        state.ready = true
        state.themePref = payload.themePref
        state.resolvedTheme = payload.resolvedTheme
        state.locale = payload.locale
        state.recents = payload.recents
        state.setupComplete = payload.setupComplete ?? true
        state.projectsDir = payload.projectsDir ?? null
      }),

    finishSetup: (projectsDir, recents) =>
      set((state) => {
        state.setupComplete = true
        state.projectsDir = projectsDir
        state.recents = recents
      }),

    setResolvedTheme: (theme) =>
      set((state) => {
        state.resolvedTheme = theme
      }),

    setThemePref: (pref) =>
      set((state) => {
        state.themePref = pref
      }),

    setLocale: (locale) =>
      set((state) => {
        state.locale = locale
      }),

    cycleTheme: () => {
      const current = get().themePref
      const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length]
      set((state) => {
        state.themePref = next
      })
      return next
    },

    openWizard: (open) =>
      set((state) => {
        state.wizardOpen = open
      }),

    openGallery: (anchor) =>
      set((state) => {
        state.galleryOpen = true
        state.galleryAnchor = anchor ?? null
        state.tool = 'image'
      }),

    closeGallery: () =>
      set((state) => {
        state.galleryOpen = false
        state.galleryAnchor = null
        if (state.tool === 'image') state.tool = 'select'
      }),

    setBusy: (busy) =>
      set((state) => {
        state.busy = busy
      }),

    setRecents: (recents) =>
      set((state) => {
        state.recents = recents
      }),

    goHome: () =>
      set((state) => {
        state.route = 'home'
      }),

    createProject: (input) =>
      set((state) => {
        const document = createEmptyDocument(input)
        state.document = document
        state.filePath = null
        state.dirty = true
        state.route = 'editor'
        state.activeScreenId = document.screens[0]?.id ?? null
        state.selectedIds = []
        state.tool = 'select'
        state.wizardOpen = false
        state.past = []
        state.future = []
      }),

    loadFromFile: (path, contents) => {
      const document = parseDocument(contents)
      set((state) => {
        state.document = document
        state.filePath = path
        state.dirty = false
        state.route = 'editor'
        state.activeScreenId = document.screens[0]?.id ?? null
        state.selectedIds = []
        state.recents = [path, ...state.recents.filter((item) => item !== path)].slice(0, 12)
        state.wizardOpen = false
        state.past = []
        state.future = []
      })
    },

    markSaved: (path) =>
      set((state) => {
        const previous = state.filePath
        state.filePath = path
        state.dirty = false
        state.recents = [path, ...state.recents.filter((item) => item !== path && item !== previous)].slice(0, 12)
      }),

    setTool: (tool) =>
      set((state) => {
        state.tool = tool
        if (tool === 'image') {
          state.galleryOpen = true
          state.galleryAnchor = null
        }
      }),

    setLeftTab: (tab) =>
      set((state) => {
        state.leftTab = tab
      }),

    setActiveScreen: (id) =>
      set((state) => {
        state.activeScreenId = id
        state.selectedIds = []
      }),

    pushHistory: () => {
      const document = get().document
      if (!document) return
      const snap = structuredClone(document)
      set((state) => {
        state.past.push(snap)
        if (state.past.length > 50) state.past.shift()
        state.future = []
      })
    },

    undo: () => {
      const { document, past } = get()
      if (!document || past.length === 0) return
      const prev = past[past.length - 1]
      if (!prev) return
      const current = structuredClone(document)
      set((state) => {
        state.future.push(current)
        state.document = structuredClone(prev)
        state.past.pop()
        state.dirty = true
        const screen = state.document.screens.find((item) => item.id === state.activeScreenId)
        if (!screen) state.activeScreenId = state.document.screens[0]?.id ?? null
        state.selectedIds = state.selectedIds.filter((id) =>
          state.document?.screens.some((item) => item.children.some((node) => node.id === id))
        )
      })
    },

    redo: () => {
      const { document, future } = get()
      if (!document || future.length === 0) return
      const next = future[future.length - 1]
      if (!next) return
      const current = structuredClone(document)
      set((state) => {
        state.past.push(current)
        state.document = structuredClone(next)
        state.future.pop()
        state.dirty = true
        const screen = state.document.screens.find((item) => item.id === state.activeScreenId)
        if (!screen) state.activeScreenId = state.document.screens[0]?.id ?? null
      })
    },

    addScreen: () => {
      get().pushHistory()
      set((state) => {
        if (!state.document) return
        const index = state.document.screens.length + 1
        const used = new Set(state.document.screens.map((item) => item.cIdentifier))
        const name = `Screen ${index}`
        const screen: Screen = {
          id: `s${index}_${Date.now()}`,
          name,
          cIdentifier: toCIdentifier(name, used),
          x: state.document.screens.length * (state.document.device.width + 24),
          y: 0,
          userCode: { prefix: '', suffix: '' },
          children: []
        }
        state.document.screens.push(screen)
        state.activeScreenId = screen.id
        state.dirty = true
      })
    },

    setZoom: (zoom) =>
      set((state) => {
        if (!state.document) return
        state.document.ui.zoom = Math.min(64, Math.max(1, Math.round(zoom)))
      }),

    setPan: (x, y) =>
      set((state) => {
        if (!state.document) return
        state.document.ui.pan = [x, y]
      }),

    nudgePan: (dx, dy) =>
      set((state) => {
        if (!state.document) return
        state.document.ui.pan = [state.document.ui.pan[0] + dx, state.document.ui.pan[1] + dy]
      }),

    setView: (zoom, pan) =>
      set((state) => {
        if (!state.document) return
        state.document.ui.zoom = Math.min(64, Math.max(1, zoom))
        state.document.ui.pan = pan
      }),

    moveScreen: (id, x, y, record = true) => {
      if (record) get().pushHistory()
      set((state) => {
        if (!state.document) return
        const screen = state.document.screens.find((item) => item.id === id)
        if (!screen) return
        screen.x = Math.round(x)
        screen.y = Math.round(y)
        state.dirty = true
      })
    },

    toggleGrid: () => {
      get().pushHistory()
      set((state) => {
        if (!state.document) return
        state.document.ui.grid = !state.document.ui.grid
        state.dirty = true
      })
    },

    showToast: (message) =>
      set((state) => {
        state.toast = { id: toastSeq++, message }
      }),

    clearToast: () =>
      set((state) => {
        state.toast = null
      })
  }))
)

export function currentScreen(document: IvecDocument | null, id: string | null): Screen | null {
  if (!document) return null
  return document.screens.find((screen) => screen.id === id) ?? document.screens[0] ?? null
}

export function serializedCurrent(): string | null {
  const document = useAppStore.getState().document
  return document ? serializeDocument(document) : null
}
