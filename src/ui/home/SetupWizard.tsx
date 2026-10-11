import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import logo from '@/assets/brand/logo.png'
import { useAppStore } from '@/store/app-store'
import { WindowControls, titlebarMaximizeIfEmpty } from '@/ui/chrome/WindowControls'
import { Button, Field, Input, Switch } from '@/ui/primitives'

export function SetupWizard() {
  const { t } = useTranslation()
  const [projectsDir, setProjectsDir] = useState('')
  const [desktopShortcut, setDesktopShortcut] = useState(true)
  const [shortcutSupported, setShortcutSupported] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!window.ivec) return
    void window.ivec.getSetupState().then((setup) => {
      setProjectsDir(setup.projectsDir || setup.defaultProjectsDir)
      setShortcutSupported(setup.desktopShortcutSupported)
      setDesktopShortcut(setup.desktopShortcutSupported)
    })
  }, [])

  async function finish() {
    if (!window.ivec || busy) return
    const dir = projectsDir.trim()
    if (!dir) return
    setBusy(true)
    try {
      const result = await window.ivec.completeSetup({
        projectsDir: dir,
        desktopShortcut: shortcutSupported && desktopShortcut
      })
      useAppStore.getState().finishSetup(dir, result.recents)
    } catch {
      useAppStore.getState().showToast(t('errors.setupFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-app">
      <header className="app-drag flex h-10 items-center justify-end border-b border-line bg-panel" onDoubleClick={titlebarMaximizeIfEmpty}>
        <WindowControls />
      </header>
      <div className="grid flex-1 place-items-center p-6">
      <div className="w-full max-w-lg rounded-md border border-line bg-panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <img src={logo} alt="" className="size-10 rounded" />
          <div>
            <h1 className="text-[15px] font-semibold">{t('setup.title')}</h1>
            <p className="text-[12px] text-muted">{t('setup.subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <p className="text-[12px] leading-5 text-ink">{t('setup.body')}</p>

          <Field label={t('setup.projectsDir')}>
            <div className="flex gap-2">
              <Input className="flex-1" value={projectsDir} onChange={(event) => setProjectsDir(event.target.value)} />
              <Button
                disabled={busy}
                onClick={() => {
                  if (!window.ivec) return
                  void window.ivec.pickProjectsDir().then((path) => {
                    if (path) setProjectsDir(path)
                  })
                }}
              >
                {t('setup.browse')}
              </Button>
            </div>
          </Field>
          <p className="text-[11px] text-muted">{t('setup.projectsHint')}</p>

          {shortcutSupported ? (
            <Switch checked={desktopShortcut} onChange={setDesktopShortcut} label={t('setup.desktopShortcut')} />
          ) : null}

          <div className="flex justify-end pt-1">
            <Button tone="primary" disabled={busy || !projectsDir.trim()} onClick={() => void finish()}>
              {busy ? t('setup.working') : t('setup.continue')}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
