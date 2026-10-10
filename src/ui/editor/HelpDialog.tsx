import { useTranslation } from 'react-i18next'
import { Button, Kbd } from '@/ui/primitives'

const ROWS = [
  { keys: 'Ctrl+S', label: 'save' },
  { keys: 'Ctrl+Shift+L', label: 'theme' },
  { keys: 'Ctrl+Z / Y', label: 'undo' },
  { keys: 'Ctrl+X', label: 'cut' },
  { keys: 'Ctrl+C', label: 'copy' },
  { keys: 'Ctrl+V', label: 'paste' },
  { keys: 'Ctrl+A', label: 'selectAll' },
  { keys: 'Shift+↑↓←→', label: 'nudge' },
  { keys: 'Esc', label: 'deselect' },
  { keys: 'Wheel', label: 'zoom' },
  { keys: 'Ctrl+Wheel', label: 'pan' },
  { keys: 'Ctrl+/', label: 'help' }
] as const

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-app" onMouseDown={onClose}>
      <div
        className="w-[360px] rounded-md border border-line bg-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between border-b border-line px-3">
          <h2 className="text-[13px] font-semibold">{t('editor.help')}</h2>
          <Button tone="ghost" onClick={onClose}>
            Esc
          </Button>
        </div>
        <div className="grid gap-1 p-3">
          {ROWS.map((row) => (
            <div key={row.label} className="flex h-7 items-center justify-between">
              <span className="text-[12px]">{t(`help.${row.label}`)}</span>
              <Kbd>{row.keys}</Kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
