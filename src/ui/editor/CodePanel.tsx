import { Check, Copy, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SceneNode } from '@/core/document/model'
import { placeholderCode, toCIdentifier } from '@/core/document/model'
import { nodeBounds } from '@/core/render/raster-node'
import { currentScreen, useAppStore } from '@/store/app-store'
import { downloadShapeHeader, exportIconHeaders, isAnimationNode, isIconNode, setExportFlag } from '@/ui/editor/document-actions'
import { NodeThumb } from '@/ui/editor/NodeThumb'
import { Button, CodeView, Switch, Tabs } from '@/ui/primitives'

const FLAGS = ['wrapperFunction', 'includeFonts', 'declareImages', 'comments', 'clearDisplay'] as const

function isExportable(node: SceneNode): boolean {
  return node.visible && node.role !== 'reference' && isIconNode(node)
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
          className="flex flex-col items-center gap-1 rounded border border-line bg-elevated p-1 hover:border-accent"
        >
          <NodeThumb node={item.node} />
          <span className="w-full truncate text-center text-[10px] text-muted">{item.ident}.h</span>
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
  const [headerTab, setHeaderTab] = useState<'images' | 'animations'>('images')
  const screen = currentScreen(project, activeScreenId)
  const layersKey = screen
    ? screen.children
        .map((node) =>
          [node.id, node.type, node.name, node.x, node.y, node.w, node.h, node.visible, node.color, node.strokeColor, node.fill, node.stroke, node.radius, node.text, node.font, node.role, node.flipX, node.flipY, node.asset, node.frames?.length, node.fps, node.points?.length].join(':')
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
  const images = exportable.filter((item) => !isAnimationNode(item.node))
  const animations = exportable.filter((item) => isAnimationNode(item.node))
  const headerItems = headerTab === 'animations' ? animations : images

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
        <div className="flex h-9 min-w-0 items-center gap-2 overflow-hidden border-b border-line pr-2">
          <Tabs
            flush
            scroll
            value={screen.id}
            onChange={(id) => useAppStore.getState().setActiveScreen(id)}
            options={project.screens.map((item) => ({ id: item.id, label: item.name }))}
          />
          <div className="flex shrink-0 items-center gap-1">
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
            <Button onClick={() => void exportIconHeaders()}>
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
          <div className="border-b border-line">
            <Tabs
              value={headerTab}
              onChange={setHeaderTab}
              options={[
                { id: 'images', label: t('editor.headerImages') },
                { id: 'animations', label: t('editor.headerAnimations') }
              ]}
            />
            <HeaderGrid
              items={headerItems}
              empty={headerTab === 'animations' ? t('editor.noAnimHeaders') : t('editor.noIconHeaders')}
              onSave={saveHeader}
            />
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
