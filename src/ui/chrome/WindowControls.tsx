import { Minus, Square, X } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

export function WindowControls() {
  const { t } = useTranslation()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!window.ivec) return
    void window.ivec.windowIsMaximized().then(setMaximized)
  }, [])

  if (!window.ivec) return null

  return (
    <div className="app-no-drag ml-auto flex h-10 shrink-0 items-stretch">
      <button
        type="button"
        className="grid w-11 place-items-center text-muted hover:bg-hover hover:text-ink"
        aria-label={t('window.minimize')}
        onClick={() => void window.ivec?.windowMinimize()}
      >
        <Minus size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="grid w-11 place-items-center text-muted hover:bg-hover hover:text-ink"
        aria-label={maximized ? t('window.restore') : t('window.maximize')}
        onClick={() => {
          void window.ivec?.windowMaximize().then(() => window.ivec?.windowIsMaximized().then(setMaximized))
        }}
      >
        <Square size={12} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="grid w-11 place-items-center text-muted hover:bg-danger hover:text-on-accent"
        aria-label={t('window.close')}
        onClick={() => void window.ivec?.windowClose()}
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function titlebarMaximizeIfEmpty(event: MouseEvent) {
  if (!window.ivec) return
  if (event.target instanceof Element && event.target.closest('.app-no-drag')) return
  void window.ivec.windowMaximize()
}
