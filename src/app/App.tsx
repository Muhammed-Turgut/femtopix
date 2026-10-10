import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/app/i18n'
import { persistCurrent } from '@/app/project-io'
import { useAppStore } from '@/store/app-store'
import { runEditCommand } from '@/ui/editor/edit-actions'
import { EditorScreen } from '@/ui/editor/EditorScreen'
import { HomeScreen } from '@/ui/home/HomeScreen'
import { NewProjectDialog } from '@/ui/home/NewProjectDialog'

export function App() {
  const { t, i18n } = useTranslation()
  const ready = useAppStore((s) => s.ready)
  const route = useAppStore((s) => s.route)
  const resolvedTheme = useAppStore((s) => s.resolvedTheme)
  const locale = useAppStore((s) => s.locale)
  const wizardOpen = useAppStore((s) => s.wizardOpen)
  const toast = useAppStore((s) => s.toast)

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.lang = locale
  }, [resolvedTheme, locale])

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale)
  }, [i18n, locale])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => useAppStore.getState().clearToast(), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let unsub: (() => void) | undefined
    const boot = async () => {
      if (!window.ivec) {
        useAppStore.getState().hydrate({
          themePref: 'system',
          resolvedTheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          locale: 'tr',
          recents: []
        })
        return
      }
      const [settings, resolved, library] = await Promise.all([
        window.ivec.getSettings(),
        window.ivec.getResolvedTheme(),
        window.ivec.listLibraryProjects()
      ])
      useAppStore.getState().hydrate({
        themePref: settings.theme,
        resolvedTheme: resolved,
        locale: settings.locale,
        recents: [...new Set([...library, ...settings.recents])]
      })
      unsub = window.ivec.onThemeChange((theme) => useAppStore.getState().setResolvedTheme(theme))
    }
    void boot()
    return () => unsub?.()
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const unsub = useAppStore.subscribe((state, prev) => {
      if (!window.ivec || !state.dirty || !state.filePath || !state.document) return
      if (state.document === prev.document && state.dirty === prev.dirty) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void persistCurrent().catch(() => {
          useAppStore.getState().showToast(i18n.t('errors.saveFailed'))
        })
      }, 400)
    })
    return () => {
      window.clearTimeout(timer)
      unsub()
    }
  }, [])

  useEffect(() => {
    const onMenu = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail === 'new') useAppStore.getState().openWizard(true)
      if (detail === 'open') void openProject()
      if (detail === 'save') void saveProject()
      if (detail === 'cycleTheme') void cycleTheme()
      if (detail === 'undo' || detail === 'redo' || detail === 'cut' || detail === 'copy' || detail === 'paste' || detail === 'selectAll') {
        runEditCommand(detail)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        void cycleTheme()
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveProject()
      }
      if (mod && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void openProject()
      }
      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        useAppStore.getState().openWizard(true)
      }
    }
    window.addEventListener('ivec:menu', onMenu)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('ivec:menu', onMenu)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!ready) {
    return <div className="grid h-full place-items-center text-muted">{t('app.name')}</div>
  }

  return (
    <div className="h-full">
      {route === 'home' ? <HomeScreen onOpen={() => void openProject()} /> : <EditorScreen onSave={() => void saveProject()} />}
      {wizardOpen ? <NewProjectDialog /> : null}
      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-line bg-panel px-3 py-1.5 text-[12px] text-ink">
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}

async function cycleTheme() {
  const next = useAppStore.getState().cycleTheme()
  if (!window.ivec) {
    const resolved =
      next === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : next
    useAppStore.getState().setResolvedTheme(resolved)
    return
  }
  const resolved = await window.ivec.setTheme(next)
  useAppStore.getState().setResolvedTheme(resolved)
}

async function openProject() {
  if (!window.ivec) return
  try {
    const opened = await window.ivec.openProjectDialog()
    if (!opened) return
    useAppStore.getState().loadFromFile(opened.path, opened.contents)
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    useAppStore.getState().showToast(i18n.t(code === 'too_large' ? 'errors.tooLarge' : 'errors.openFailed'))
  }
}

async function saveProject() {
  if (!useAppStore.getState().document || !window.ivec) return
  try {
    await persistCurrent()
    useAppStore.getState().showToast(i18n.t('editor.save'))
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.saveFailed'))
  }
}
