import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEVICE_PROFILES, listSelectableProfiles } from '@/core/devices/profiles'
import type { ExportTarget } from '@/core/document/model'
import { createAndPersistProject } from '@/app/project-io'
import { useAppStore } from '@/store/app-store'
import { libraryLabel } from '@/ui/editor/document-actions'
import { Button, Field, Input } from '@/ui/primitives'

export function NewProjectDialog() {
  const { t } = useTranslation()
  const close = () => useAppStore.getState().openWizard(false)
  const [name, setName] = useState('')
  const [profileId, setProfileId] = useState('ssd1306-128x64')
  const [library, setLibrary] = useState<ExportTarget>('u8g2')
  const [width, setWidth] = useState(128)
  const [height, setHeight] = useState(64)

  const profile = useMemo(
    () => DEVICE_PROFILES.find((item) => item.id === profileId) ?? DEVICE_PROFILES[0],
    [profileId]
  )
  const custom = profileId === 'custom'
  const available = listSelectableProfiles()

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-app p-6" onMouseDown={close}>
      <div
        className="w-full max-w-2xl rounded-md border border-line bg-panel p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex h-8 items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t('wizard.title')}</h2>
          <Button tone="ghost" onClick={close}>
            {t('wizard.cancel')}
          </Button>
        </div>

        <div className="grid gap-3">
          <Field label={t('wizard.name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('editor.untitled')} />
          </Field>

          <div>
            <div className="mb-2 text-[11px] font-medium text-muted">{t('wizard.device')}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {available.map((item) => {
                const selected = item.id === profileId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setProfileId(item.id)
                      setWidth(item.width)
                      setHeight(item.height)
                      if (!item.libraries.includes(library)) setLibrary(item.defaultLibrary)
                    }}
                    className={`rounded-md border p-3 text-left ${
                      selected ? 'border-accent bg-selected' : 'border-line bg-elevated hover:bg-hover'
                    }`}
                  >
                    <div className="mb-2 grid h-12 place-items-center rounded bg-canvas">
                      <div
                        className="border border-line-strong"
                        style={{
                          width: Math.min(72, item.width / 2),
                          height: Math.min(36, item.height / 2),
                          background: 'var(--bg-screen)'
                        }}
                      />
                    </div>
                    <div className="text-[12px] font-medium">{item.id === 'custom' ? t('wizard.customSize') : item.name}</div>
                    <div className="text-[11px] text-muted tabular-nums">
                      {item.id === 'custom' ? t('wizard.customSize') : `${item.width}×${item.height}`}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {custom ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('wizard.width')}>
                <Input type="number" min={1} max={8192} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
              </Field>
              <Field label={t('wizard.height')}>
                <Input type="number" min={1} max={8192} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
              </Field>
            </div>
          ) : null}

          <div>
            <div className="mb-2 text-[11px] font-medium text-muted">{t('wizard.library')}</div>
            <div className="flex flex-wrap gap-2">
              {(profileId === 'custom' ? (['u8g2', 'adafruit_gfx', 'tft_espi', 'arduino_gfx'] as ExportTarget[]) : profile.libraries).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLibrary(item)}
                  className={`h-7 rounded border px-2 text-[12px] ${
                    library === item ? 'border-accent bg-accent text-on-accent' : 'border-line bg-elevated text-ink hover:bg-hover'
                  }`}
                >
                  {libraryLabel(item)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={close}>{t('wizard.cancel')}</Button>
            <Button
              tone="primary"
              onClick={() =>
                void createAndPersistProject({
                  name: name.trim() || t('editor.untitled'),
                  profileId,
                  width: custom ? width : undefined,
                  height: custom ? height : undefined,
                  library
                })
              }
            >
              {t('wizard.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
