import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Lock,
  LockOpen,
  Square,
  UnfoldHorizontal,
  UnfoldVertical
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEVICE_PROFILES, listSelectableProfiles } from '@/core/devices/profiles'
import type { ColorMode, ExportTarget } from '@/core/document/model'
import { currentScreen, useAppStore } from '@/store/app-store'
import {
  alignSelection,
  distributeSelection,
  flipSelection,
  libraryLabel,
  patchNode,
  renameNode,
  renameScreen,
  saveIconHeader,
  selectedNode,
  setDeviceLibrary,
  setDeviceMode,
  setDeviceProfile,
  setScreenSize,
  toggleNodeFlag,
  type AlignKey
} from '@/ui/editor/document-actions'
import { cssHexFromColor } from '@/core/color/rgb565'
import { applyTextFont, defaultBitmapFont, fitTextNode, fontsForLibrary, setTextBaselineY, textBaselineY } from '@/core/fonts/bitmap-font'
import { Button, ColorField, Field, IconButton, Input, NumberInput, Section, Select, Switch, Tooltip } from '@/ui/primitives'

const ALIGN: { Icon: typeof AlignStartHorizontal; key: AlignKey; label: 'alignLeft' | 'alignCenterX' | 'alignRight' | 'alignTop' | 'alignCenterY' | 'alignBottom' }[] = [
  { Icon: AlignStartHorizontal, key: 'startX', label: 'alignLeft' },
  { Icon: AlignCenterHorizontal, key: 'centerX', label: 'alignCenterX' },
  { Icon: AlignEndHorizontal, key: 'endX', label: 'alignRight' },
  { Icon: AlignStartVertical, key: 'startY', label: 'alignTop' },
  { Icon: AlignCenterVertical, key: 'centerY', label: 'alignCenterY' },
  { Icon: AlignEndVertical, key: 'endY', label: 'alignBottom' }
]

export function RightPanel() {
  const { t } = useTranslation()
  const document = useAppStore((s) => s.document)
  const activeScreenId = useAppStore((s) => s.activeScreenId)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const screen = currentScreen(document, activeScreenId)
  const node = selectedNode()

  if (!document || !screen) return null

  const arrangeBar = selectedIds.length > 0 ? (
    <div className="flex h-8 items-center gap-0.5 border-b border-line px-2">
      {ALIGN.map(({ Icon, key, label }) => (
        <Tooltip key={key} content={t(`editor.${label}`)}>
          <IconButton aria-label={t(`editor.${label}`)} onClick={() => alignSelection(key)}>
            <Icon size={16} strokeWidth={1.5} />
          </IconButton>
        </Tooltip>
      ))}
      <div className="mx-0.5 h-4 w-px bg-line" />
      <Tooltip content={t('editor.distributeH')}>
        <IconButton aria-label={t('editor.distributeH')} onClick={() => distributeSelection('x')}>
          <UnfoldHorizontal size={16} strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('editor.distributeV')}>
        <IconButton aria-label={t('editor.distributeV')} onClick={() => distributeSelection('y')}>
          <UnfoldVertical size={16} strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
      <div className="mx-0.5 h-4 w-px bg-line" />
      <Tooltip content={t('editor.flipH')}>
        <IconButton aria-label={t('editor.flipH')} onClick={() => flipSelection('x')}>
          <FlipHorizontal2 size={16} strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('editor.flipV')}>
        <IconButton aria-label={t('editor.flipV')} onClick={() => flipSelection('y')}>
          <FlipVertical2 size={16} strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
    </div>
  ) : null

  if (selectedIds.length === 0 || !node) {
    return (
      <div className="scrollbar-thin h-full overflow-auto bg-panel">
        {arrangeBar}
        {selectedIds.length > 1 ? (
          <div className="border-b border-line px-3 py-2 text-[12px] text-muted">{t('editor.selectedCount', { count: selectedIds.length })}</div>
        ) : null}
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

  const invert = node.color === 'invert' || node.strokeColor === 'invert'
  const canFill = node.type === 'rect' || node.type === 'ellipse' || node.type === 'triangle' || node.type === 'polygon' || node.type === 'arc'
  const canStroke = canFill || node.type === 'line' || node.type === 'polyline' || node.type === 'paint'

  return (
    <div className="scrollbar-thin h-full overflow-auto bg-panel">
      {arrangeBar}
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
          <NumberInput
            label="Y"
            value={node.type === 'text' ? textBaselineY(node) : node.y}
            onChange={(y) =>
              patchNode(screen.id, node.id, (item) => {
                if (item.type === 'text') setTextBaselineY(item, y)
                else item.y = y
              })
            }
          />
          {node.type === 'text' ? null : (
            <>
              <NumberInput label="W" value={node.w ?? 0} onChange={(w) => patchNode(screen.id, node.id, (item) => { item.w = w })} />
              <NumberInput label="H" value={node.h ?? 0} onChange={(h) => patchNode(screen.id, node.id, (item) => { item.h = h })} />
            </>
          )}
          {node.type === 'rect' ? (
            <NumberInput
              label="R"
              value={node.radius ?? 0}
              min={0}
              max={Math.max(0, Math.floor((Math.min(Math.abs(node.w ?? 1), Math.abs(node.h ?? 1)) - 1) / 2))}
              onChange={(radius) => patchNode(screen.id, node.id, (item) => { item.radius = radius })}
            />
          ) : null}
        </div>
      </Section>
      <Section title={t('editor.appearance')}>
        {canFill ? (
          <>
            <Switch
              checked={Boolean(node.fill)}
              onChange={(fill) => patchNode(screen.id, node.id, (item) => { item.fill = fill })}
              label={t('editor.fill')}
            />
            <Field label={t('editor.fillColor')}>
              <ColorField
                value={cssHexFromColor(node.color)}
                onChange={(hex) => patchNode(screen.id, node.id, (target) => { target.color = hex })}
              />
            </Field>
          </>
        ) : !canStroke ? (
          <Field label={t('editor.color')}>
            <ColorField
              value={cssHexFromColor(node.color)}
              onChange={(hex) => patchNode(screen.id, node.id, (target) => { target.color = hex })}
            />
          </Field>
        ) : null}
        {canStroke ? (
          <>
            <Switch
              checked={(node.stroke ?? 0) > 0}
              onChange={(on) => patchNode(screen.id, node.id, (item) => { item.stroke = on ? item.stroke || 1 : 0 })}
              label={t('editor.stroke')}
            />
            <Field label={t('editor.strokeColor')}>
              <ColorField
                value={cssHexFromColor(node.strokeColor ?? node.color)}
                onChange={(hex) => patchNode(screen.id, node.id, (target) => { target.strokeColor = hex })}
              />
            </Field>
            {(node.stroke ?? 0) > 0 ? (
              <NumberInput
                label="px"
                value={node.stroke ?? 1}
                min={1}
                max={16}
                onChange={(stroke) => patchNode(screen.id, node.id, (item) => { item.stroke = stroke })}
              />
            ) : null}
          </>
        ) : null}
        <Switch
          checked={invert}
          onChange={(on) =>
            patchNode(screen.id, node.id, (item) => {
              item.color = on ? 'invert' : 1
              item.strokeColor = on ? 'invert' : 1
            })
          }
          label={t('editor.invert')}
        />
      </Section>
      {node.type === 'text' ? (
        <Section title={t('editor.text')}>
          <Field label={t('editor.content')}>
            <Input
              value={node.text ?? ''}
              onChange={(event) =>
                patchNode(screen.id, node.id, (item) => {
                  item.text = event.target.value
                  fitTextNode(item)
                })
              }
            />
          </Field>
          <Field label={t('editor.font')}>
            <Select
              value={node.font ?? defaultBitmapFont(document.device.library)}
              onChange={(font) =>
                patchNode(screen.id, node.id, (item) => {
                  applyTextFont(item, font)
                })
              }
              options={fontsForLibrary(document.device.library).map((font) => ({ value: font.id, label: font.label }))}
            />
          </Field>
        </Section>
      ) : null}
      {node.type === 'image' || node.type === 'paint' ? (
        <Section title={t('editor.iconHeaders')}>
          {node.type === 'image' ? (
            <div className="truncate text-[12px] text-ink">{node.asset ? node.name : t('editor.emptyAssetsTitle')}</div>
          ) : null}
          <Button onClick={() => void saveIconHeader(node)}>{t('editor.saveIconHeader')}</Button>
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
