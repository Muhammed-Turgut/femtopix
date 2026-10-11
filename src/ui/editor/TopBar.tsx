import { ChevronDown, HelpCircle, Save, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import logo from '@/assets/brand/logo.png'
import { DEVICE_PROFILES, getProfile, listSelectableProfiles } from '@/core/devices/profiles'
import type { ColorMode, ExportTarget } from '@/core/document/model'
import { useAppStore } from '@/store/app-store'
import { ThemeControls } from '@/ui/chrome/ThemeControls'
import { WindowControls, titlebarMaximizeIfEmpty } from '@/ui/chrome/WindowControls'
import {
  exportIconHeaders,
  libraryLabel,
  renameProject,
  setDeviceLibrary,
  setDeviceMode,
  setDeviceProfile,
  setScreenSize
} from '@/ui/editor/document-actions'
import { Button, Field, IconButton, Input, NumberInput, Select, Tooltip } from '@/ui/primitives'

export function TopBar({ onSave, onHelp }: { onSave: () => void; onHelp: () => void }) {
  const { t } = useTranslation()
  const document = useAppStore((s) => s.document)
  const dirty = useAppStore((s) => s.dirty)
  if (!document) return null

  const profile = getProfile(document.device.profile)
  const name = document.meta.name

  return (
    <header
      className="app-drag flex h-10 shrink-0 items-center border-b border-line bg-panel"
      onDoubleClick={titlebarMaximizeIfEmpty}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-3">
        <button type="button" className="app-no-drag flex items-center gap-2" onClick={() => useAppStore.getState().goHome()}>
          <img src={logo} alt="" className="size-6 rounded" />
          <span className="text-[13px] font-semibold">{t('editor.workspace')}</span>
        </button>
        <div className="app-no-drag flex min-w-0 items-center gap-1">
          <Input
            value={name}
            placeholder={t('editor.untitled')}
            onChange={(event) => renameProject(event.target.value)}
            onBlur={(event) => {
              if (!event.target.value.trim()) renameProject(t('editor.untitled'))
            }}
            className="h-7 w-[200px] max-w-[240px] bg-transparent text-left text-[13px] font-medium"
          />
          {dirty ? <span className="text-muted">•</span> : null}
        </div>
        <div className="app-no-drag ml-auto flex items-center gap-2">
          <DeviceMenu
            profileId={document.device.profile}
            profileName={profile.id === 'custom' ? t('wizard.customSize') : profile.name}
            width={document.device.width}
            height={document.device.height}
            colorMode={document.device.colorMode}
            library={document.device.library}
          />
          <Button tone="ghost" onClick={onSave}>
            <Save size={16} strokeWidth={1.5} />
            {t('editor.save')}
          </Button>
          <Button tone="primary" onClick={() => void exportIconHeaders()}>
            <Upload size={16} strokeWidth={1.5} />
            {t('editor.export')}
          </Button>
          <Tooltip
            content={
              <span className="flex items-center gap-1">
                {t('editor.help')} <span className="font-mono">Ctrl+/</span>
              </span>
            }
          >
            <IconButton onClick={onHelp} aria-label={t('editor.help')}>
              <HelpCircle size={16} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>
          <ThemeControls />
        </div>
      </div>
      <WindowControls />
    </header>
  )
}

function DeviceMenu({
  profileId,
  profileName,
  width,
  height,
  colorMode,
  library
}: {
  profileId: string
  profileName: string
  width: number
  height: number
  colorMode: ColorMode
  library: ExportTarget
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (root.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-select-menu]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 items-center gap-1 rounded border border-line bg-elevated px-2 text-[11px] text-ink tabular-nums hover:bg-hover"
      >
        {profileName} {width}×{height}
        <ChevronDown size={16} strokeWidth={1.5} className="text-muted" />
      </button>
      {open ? (
        <div
          className="absolute top-8 right-0 z-50 w-64 rounded-md border border-line bg-panel p-3"
        >
          <div className="grid gap-2">
            <Field label={t('editor.profile')}>
              <Select
                value={profileId}
                onChange={setDeviceProfile}
                options={listSelectableProfiles().map((profile) => ({
                  value: profile.id,
                  label: profile.id === 'custom' ? t('wizard.customSize') : `${profile.name} ${profile.width}×${profile.height}`
                }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="W" value={width} min={1} max={8192} onChange={(next) => setScreenSize(next, height)} />
              <NumberInput label="H" value={height} min={1} max={8192} onChange={(next) => setScreenSize(width, next)} />
            </div>
            <Field label={t('editor.mode')}>
              <Select
                value={colorMode}
                onChange={(mode) => setDeviceMode(mode as ColorMode)}
                options={[
                  { value: 'mono', label: t('editor.modeMono') },
                  { value: 'gray2', label: t('editor.modeGray2') },
                  { value: 'gray4', label: t('editor.modeGray4') },
                  { value: 'rgb565', label: t('editor.modeRgb565') }
                ]}
              />
            </Field>
            <Field label={t('editor.target')}>
              <Select
                value={library}
                onChange={(next) => setDeviceLibrary(next as ExportTarget)}
                options={(DEVICE_PROFILES.find((item) => item.id === profileId)?.libraries ?? ['u8g2']).map((item) => ({
                  value: item,
                  label: libraryLabel(item)
                }))}
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  )
}
