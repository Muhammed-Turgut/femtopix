import { Check, Copy, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SceneNode } from '@/core/document/model'
import { placeholderCode, toCIdentifier } from '@/core/document/model'
import { nodeBounds } from '@/core/render/raster-node'
import { currentScreen, useAppStore } from '@/store/app-store'
import { downloadGeneratedCode, downloadShapeHeader, setExportFlag } from '@/ui/editor/document-actions'
import { NodeThumb } from '@/ui/editor/NodeThumb'
import { Button, CodeView, Switch, Tabs } from '@/ui/primitives'

const FLAGS = ['wrapperFunction', 'includeFonts', 'declareImages', 'comments', 'clearDisplay'] as const

const ICON_TYPES = new Set<SceneNode['type']>(['image'])

function isExportable(node: SceneNode): boolean {
  return node.visible && node.role !== 'reference'
}

function HeaderGrid({
  items,
  empty,
  onSave
}: {
  items: { node: SceneNode; ident: string }[]
  empty: string
  onSave: (node: SceneNode, ident: string) => void
}) {
  if (!items.length) return <div className="px-1 py-2 text-[12px] text-muted">{empty}</div>
  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {items.map((item) => (
        <button
          key={item.node.id}
          type="button"
          title={`${item.ident}.h`}
          aria-label={`${item.ident}.h`}
          onClick={() => onSave(item.node, item.ident)}
          className="grid aspect-square place-items-center rounded border border-line bg-elevated hover:border-accent"
        >
          <NodeThumb node={item.node} />
        </button>
      ))}
    </div>
  )
}

export function CodePanel() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.document)
  const activeScreenId = useAppStore((s) => s.activeScreenId)
  const [copied, setCopied] = useState(false)
  const screen = currentScreen(project, activeScreenId)
  const layersKey = screen
    ? screen.children
        .map((node) =>
          [node.id, node.type, node.name, node.x, node.y, node.w, node.h, node.visible, node.color, node.strokeColor, node.fill, node.stroke, node.text, node.font, node.role, node.flipX, node.flipY, node.asset, node.points?.length].join(':')
        )
        .join('|')
    : ''
  const exportKey = project ? JSON.stringify(project.export) : ''
  const code = useMemo(
    () => (project && screen ? placeholderCode(project, screen) : ''),
    [project, screen, layersKey, exportKey]
  )

  if (!project || !screen) return null

  const target = project.export.targets[project.export.activeTarget] ?? {}
  const usedIdents = new Set<string>()
  const exportable = screen.children.filter(isExportable).map((node) => {
    const { w, h } = nodeBounds(node)
    return { node, ident: toCIdentifier(node.name, usedIdents), w, h }
  })
  const shapes = exportable.filter((item) => !ICON_TYPES.has(item.node.type))
  const icons = exportable.filter((item) => ICON_TYPES.has(item.node.type))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard can be denied in embedded browsers */
    }
  }

  const saveHeader = (node: SceneNode, ident: string) => {
    void downloadShapeHeader(node, ident)
  }

  return (
    <div className="flex h-full min-h-[120px] bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center justify-between border-b border-line pr-2">
          <Tabs
            flush
            value={screen.id}
            onChange={(id) => useAppStore.getState().setActiveScreen(id)}
            options={project.screens.map((item) => ({ id: item.id, label: item.name }))}
          />
          <div className="flex items-center gap-1">
            {copied ? (
              <span className="flex items-center gap-1 text-[12px] text-mint">
                <Check size={16} strokeWidth={1.5} />
                {t('editor.copied')}
              </span>
            ) : null}
            <Button tone="ghost" onClick={() => void copy()}>
              <Copy size={16} strokeWidth={1.5} />
              {t('editor.copy')}
            </Button>
            <Button onClick={() => downloadGeneratedCode()}>
              <Download size={16} strokeWidth={1.5} />
              {t('editor.download')}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <CodeView value={code} />
        </div>
      </div>
      <aside className="flex w-64 shrink-0 flex-col border-l border-line">
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="border-b border-line px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-ink">{t('editor.shapes')}</div>
            <HeaderGrid items={shapes} empty={t('editor.noShapeHeaders')} onSave={saveHeader} />
          </div>
          <div className="border-b border-line px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-ink">{t('editor.iconHeaders')}</div>
            <HeaderGrid items={icons} empty={t('editor.noIconHeaders')} onSave={saveHeader} />
          </div>
          <div className="px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-ink">{t('editor.exportOptions')}</div>
            <div className="grid gap-1">
              {FLAGS.map((flag) => (
                <Switch
                  key={flag}
                  label={t(`editor.${flag}`)}
                  checked={Boolean(target[flag] ?? true)}
                  onChange={(value) => setExportFlag(flag, value)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] text-muted tabular-nums">
          {t('editor.bitmapBytes', { count: Math.ceil((project.device.width * project.device.height) / 8) })}
        </div>
      </aside>
    </div>
  )
}
