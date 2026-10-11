import { FilePlus2, FolderOpen, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { holdBusy } from '@/app/busy'
import i18n from '@/app/i18n'
import logo from '@/assets/brand/logo.png'
import { useAppStore } from '@/store/app-store'
import { ThemeControls } from '@/ui/chrome/ThemeControls'
import { WindowControls, titlebarMaximizeIfEmpty } from '@/ui/chrome/WindowControls'
import { Button, IconButton, Input } from '@/ui/primitives'

function fileName(path: string): string {
  const base = path.split(/[\\/]/).at(-1) ?? path
  return base.replace(/\.ivec$/i, '')
}

async function openRecent(path: string) {
  if (!window.ivec || useAppStore.getState().busy) return
  const startedAt = Date.now()
  useAppStore.getState().setBusy('opening')
  try {
    const opened = await window.ivec.openRecent(path)
    await holdBusy(startedAt)
    useAppStore.getState().loadFromFile(opened.path, opened.contents)
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.openFailed'))
  } finally {
    useAppStore.getState().setBusy(null)
  }
}

async function deleteProject(path: string) {
  if (!window.ivec || useAppStore.getState().busy) return
  try {
    const recents = await window.ivec.deleteLibraryProject(path)
    useAppStore.getState().setRecents(recents)
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.deleteFailed'))
  }
}

export function HomeScreen({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  const recents = useAppStore((s) => s.recents)
  const projectsDir = useAppStore((s) => s.projectsDir)
  const busy = useAppStore((s) => s.busy)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const filtered = useMemo(
    () => recents.filter((path) => path.toLowerCase().includes(query.toLowerCase())),
    [query, recents]
  )

  return (
    <div className="flex h-full flex-col bg-app">
      <header
        className="app-drag flex h-10 items-center border-b border-line bg-panel"
        onDoubleClick={titlebarMaximizeIfEmpty}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pl-3">
          <img src={logo} alt="" className="size-6 rounded" />
          <div className="text-[13px] font-semibold">{t('app.name')}</div>
          <div className="app-no-drag relative min-w-0 max-w-sm flex-1">
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute top-1.5 left-2 text-muted" />
            <Input className="pl-7" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('home.search')} />
          </div>
          <div className="app-no-drag ml-auto flex items-center gap-2">
            <Button tone="primary" disabled={Boolean(busy)} onClick={() => useAppStore.getState().openWizard(true)}>
              <FilePlus2 size={16} strokeWidth={1.5} />
              {t('home.newProject')}
            </Button>
            <Button disabled={Boolean(busy)} onClick={onOpen}>
              <FolderOpen size={16} strokeWidth={1.5} />
              {t('home.open')}
            </Button>
            <ThemeControls />
          </div>
        </div>
        <WindowControls />
      </header>

      <main className="scrollbar-thin flex-1 overflow-auto p-6">
        <section className="mx-auto max-w-3xl">
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">{t('home.recents')}</h2>
            {projectsDir ? <p className="mb-2 text-[11px] text-muted">{t('home.projectsFolder')}: {projectsDir}</p> : null}
            {filtered.length === 0 ? (
              <p className="text-[12px] text-muted">{t('home.noRecents')}</p>
            ) : (
              <div className="grid gap-1">
                {filtered.map((path) => (
                  <div key={path} className="flex items-stretch gap-1 rounded-md border border-line bg-panel hover:bg-hover">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void openRecent(path)}
                      className="min-w-0 flex-1 px-3 py-2 text-left disabled:opacity-40"
                    >
                      <div className="truncate text-[12px] font-medium">{fileName(path)}</div>
                      <div className="truncate text-[11px] text-muted">{path}</div>
                    </button>
                    <div className="flex items-center pr-1">
                      <IconButton
                        disabled={Boolean(busy)}
                        title={t('home.delete')}
                        aria-label={t('home.delete')}
                        onClick={() => setPendingDelete(path)}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-app p-6" onMouseDown={() => setPendingDelete(null)}>
          <div
            className="w-full max-w-sm rounded-md border border-line bg-panel p-4"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="mb-2 text-[13px] font-semibold">{t('home.deleteTitle')}</h2>
            <p className="mb-4 text-[12px] text-muted">{t('home.deleteBody', { name: fileName(pendingDelete) })}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setPendingDelete(null)}>{t('wizard.cancel')}</Button>
              <Button
                tone="primary"
                onClick={() => {
                  const path = pendingDelete
                  setPendingDelete(null)
                  void deleteProject(path)
                }}
              >
                {t('home.delete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
