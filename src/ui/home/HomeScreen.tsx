import { FilePlus2, FolderOpen, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/app/i18n'
import logo from '@/assets/brand/logo.png'
import { useAppStore } from '@/store/app-store'
import { ThemeControls } from '@/ui/chrome/ThemeControls'
import { Button, Input } from '@/ui/primitives'

async function openRecent(path: string) {
  if (!window.ivec) return
  try {
    const opened = await window.ivec.openRecent(path)
    useAppStore.getState().loadFromFile(opened.path, opened.contents)
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.openFailed'))
  }
}

export function HomeScreen({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  const recents = useAppStore((s) => s.recents)
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => recents.filter((path) => path.toLowerCase().includes(query.toLowerCase())),
    [query, recents]
  )

  return (
    <div className="flex h-full flex-col bg-app">
      <header className="flex h-10 items-center gap-3 border-b border-line px-3">
        <img src={logo} alt="" className="size-6 rounded" />
        <div className="text-[13px] font-semibold">{t('app.name')}</div>
        <div className="relative max-w-sm flex-1">
          <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute top-1.5 left-2 text-muted" />
          <Input className="pl-7" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('home.search')} />
        </div>
        <Button tone="primary" onClick={() => useAppStore.getState().openWizard(true)}>
          <FilePlus2 size={16} strokeWidth={1.5} />
          {t('home.newProject')}
        </Button>
        <Button onClick={onOpen}>
          <FolderOpen size={16} strokeWidth={1.5} />
          {t('home.open')}
        </Button>
        <ThemeControls />
      </header>

      <main className="scrollbar-thin flex-1 overflow-auto p-6">
        <section className="mx-auto max-w-3xl">
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">{t('home.recents')}</h2>
            {filtered.length === 0 ? (
              <p className="text-[12px] text-muted">{t('home.noRecents')}</p>
            ) : (
              <div className="grid gap-1">
                {filtered.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => void openRecent(path)}
                    className="w-full rounded-md border border-line bg-panel px-3 py-2 text-left hover:bg-hover"
                  >
                    <div className="text-[12px] font-medium">{path.split(/[\\/]/).at(-1)}</div>
                    <div className="text-[11px] text-muted">{path}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
