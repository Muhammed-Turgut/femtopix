import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Square,
  UnfoldHorizontal
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEVICE_PROFILES, listSelectableProfiles } from '@/core/devices/profiles'
import type { ColorMode, ExportTarget } from '@/core/document/model'
import { currentScreen, useAppStore } from '@/store/app-store'
import {
  libraryLabel,
  patchNode,
  renameNode,
  renameScreen,
  selectedNode,
  setDeviceLibrary,
  setDeviceMode,
  setDeviceProfile,
  setScreenSize,
  toggleNodeFlag
} from '@/ui/editor/document-actions'
import { cssHexFromColor, isColorDisplay } from '@/core/color/rgb565'
import { ColorField, Field, IconButton, Input, NumberInput, Section, Select, Switch, Tooltip } from '@/ui/primitives'

const ALIGN = [
  { Icon: AlignStartHorizontal, key: 'startX' },
  { Icon: AlignCenterHorizontal, key: 'centerX' },
  { Icon: AlignEndHorizontal, key: 'endX' },
  { Icon: AlignStartVertical, key: 'startY' },
  { Icon: AlignCenterVertical, key: 'centerY' },
  { Icon: AlignEndVertical, key: 'endY' }
]

export function RightPanel() {
  const { t } = useTranslation()
  const document = useAppStore((s) => s.document)
  const activeScreenId = useAppStore((s) => s.activeScreenId)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const screen = currentScreen(document, activeScreenId)
  const node = selectedNode()

  if (!document || !screen) return null

  if (selectedIds.length === 0 || !node) {
    return (
      <div className="scrollbar-thin h-full overflow-auto bg-panel">
        <Section title={t('editor.screen')}>
          <Field label={t('editor.name')}>
            <Input
              value={screen.name}
              onChange={(event) => renameScreen(screen.id, event.target.value)}
              onBlur={(event) => {
                if (!event.target.value.trim()) renameScreen(screen.id, t('editor.screen'))
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="W"
              value={document.device.width}
              min={1}
              max={8192}
              onChange={(width) => setScreenSize(width, document.device.height)}
            />
            <NumberInput
              label="H"
              value={document.device.height}
              min={1}
              max={8192}
              onChange={(height) => setScreenSize(document.device.width, height)}
            />
          </div>
        </Section>
        <Section title={t('editor.device')}>
          <Field label={t('editor.profile')}>
            <Select
              value={document.device.profile}
              onChange={setDeviceProfile}
              options={listSelectableProfiles().map((profile) => ({
                value: profile.id,
                label: profile.id === 'custom' ? t('wizard.customSize') : `${profile.name} ${profile.width}×${profile.height}`
              }))}
            />
          </Field>
          <Field label={t('editor.mode')}>
            <Select
              value={document.device.colorMode}
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
              value={document.device.library}
              onChange={(library) => setDeviceLibrary(library as ExportTarget)}
              options={(DEVICE_PROFILES.find((item) => item.id === document.device.profile)?.libraries ?? ['u8g2']).map(
                (library) => ({ value: library, label: libraryLabel(library) })
              )}
            />
          </Field>
        </Section>
      </div>
    )
  }

  const color = node.color
  const invert = color === 'invert'
  const colorDisplay = isColorDisplay(document.device.colorMode)

  return (
    <div className="scrollbar-thin h-full overflow-auto bg-panel">
      <div className="flex h-8 items-center gap-0.5 border-b border-line px-2">
        {ALIGN.map(({ Icon, key }) => (
          <Tooltip key={key} content={t('editor.align')}>
            <IconButton>
              <Icon size={16} strokeWidth={1.5} />
            </IconButton>
          </Tooltip>
        ))}
        <div className="mx-0.5 h-4 w-px bg-line" />
        <Tooltip content={t('editor.distribute')}>
          <IconButton>
            <UnfoldHorizontal size={16} strokeWidth={1.5} />
          </IconButton>
        </Tooltip>
      </div>
      <Section title={t('editor.layer')}>
        <div className="flex h-7 items-center gap-1">
          {node.role === 'reference' ? (
            <Tooltip content={t('editor.referenceTooltip')}>
              <Square size={16} strokeWidth={1.5} className="text-muted" />
            </Tooltip>
          ) : (
            <Square size={16} strokeWidth={1.5} className="text-muted" />
          )}
          <Input value={node.name} onChange={(event) => renameNode(screen.id, node.id, event.target.value)} />
          <IconButton onClick={() => toggleNodeFlag(screen.id, node.id, 'visible')} aria-label={t('editor.layer')}>
            {node.visible ? <Eye size={16} strokeWidth={1.5} /> : <EyeOff size={16} strokeWidth={1.5} />}
          </IconButton>
          <IconButton onClick={() => toggleNodeFlag(screen.id, node.id, 'locked')}>
            {node.locked ? <Lock size={16} strokeWidth={1.5} /> : <LockOpen size={16} strokeWidth={1.5} />}
          </IconButton>
        </div>
      </Section>
      <Section title={t('editor.transform')}>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={node.x} onChange={(x) => patchNode(screen.id, node.id, (item) => { item.x = x })} />
          <NumberInput label="Y" value={node.y} onChange={(y) => patchNode(screen.id, node.id, (item) => { item.y = y })} />
          <NumberInput label="W" value={node.w ?? 0} onChange={(w) => patchNode(screen.id, node.id, (item) => { item.w = w })} />
          <NumberInput label="H" value={node.h ?? 0} onChange={(h) => patchNode(screen.id, node.id, (item) => { item.h = h })} />
        </div>
      </Section>
      <Section title={t('editor.appearance')}>
        {colorDisplay ? (
          <Field label={t('editor.color')}>
            <ColorField
              value={cssHexFromColor(color)}
              onChange={(hex) => patchNode(screen.id, node.id, (target) => { target.color = hex })}
            />
          </Field>
        ) : (
          <div className="flex gap-1">
            {[
              { id: 1, label: t('editor.colorOn') },
              { id: 0, label: t('editor.colorOff') },
              { id: 'invert', label: t('editor.invert') }
            ].map((item) => {
              const active = item.id === 'invert' ? invert : color === item.id
              return (
                <button
                  key={String(item.id)}
                  type="button"
                  onClick={() => patchNode(screen.id, node.id, (target) => { target.color = item.id })}
                  className={`h-6 rounded px-2 text-[11px] ${
                    active ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-hover'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        )}
        <Switch
          checked={Boolean(node.fill)}
          onChange={(fill) => patchNode(screen.id, node.id, (item) => { item.fill = fill })}
          label={t('editor.fill')}
        />
        <Switch
          checked={(node.stroke ?? 0) > 0}
          onChange={(on) => patchNode(screen.id, node.id, (item) => { item.stroke = on ? item.stroke || 1 : 0 })}
          label={t('editor.stroke')}
        />
        {(node.stroke ?? 0) > 0 ? (
          <NumberInput
            label="px"
            value={node.stroke ?? 1}
            min={1}
            max={16}
            onChange={(stroke) => patchNode(screen.id, node.id, (item) => { item.stroke = stroke })}
          />
        ) : null}
      </Section>
      {node.type === 'text' ? (
        <Section title={t('editor.text')}>
          <Field label={t('editor.font')}>
            <Select
              value={node.font ?? '6x10'}
              onChange={(font) => patchNode(screen.id, node.id, (item) => { item.font = font })}
              options={[
                { value: '6x10', label: '6×10' },
                { value: '7x13', label: '7×13' },
                { value: '8x13', label: '8×13' }
              ]}
            />
          </Field>
        </Section>
      ) : null}
      {node.type === 'image' ? (
        <Section title={t('editor.image')}>
          <div className="text-[12px] text-ink">{node.asset ?? t('editor.emptyAssetsTitle')}</div>
          {colorDisplay ? null : (
            <Switch
              checked={invert}
              onChange={(on) => patchNode(screen.id, node.id, (item) => { item.color = on ? 'invert' : 1 })}
              label={t('editor.invert')}
            />
          )}
        </Section>
      ) : null}
      <Section title={t('editor.code')}>
        <Switch
          checked={Boolean(node.vars && Object.keys(node.vars).length)}
          onChange={(on) =>
            patchNode(screen.id, node.id, (item) => {
              item.vars = on ? { x: item.name } : undefined
            })
          }
          label={t('editor.makeVariable')}
        />
      </Section>
    </div>
  )
}
