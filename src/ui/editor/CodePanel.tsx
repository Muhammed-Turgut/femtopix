import { Check, Copy, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { placeholderCode, toCIdentifier } from '@/core/document/model'
import { nodeBounds } from '@/core/render/raster-node'
import { currentScreen, useAppStore } from '@/store/app-store'
import { downloadGeneratedCode, downloadShapeHeader, setExportFlag } from '@/ui/editor/document-actions'
import { Button, CodeView, IconButton, Switch, Tabs, Tooltip } from '@/ui/primitives'

const FLAGS = ['wrapperFunction', 'includeFonts', 'declareImages', 'comments', 'clearDisplay'] as const

export function CodePanel() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.document)
  const activeScreenId = useAppStore((s) => s.activeScreenId)
  const [copied, setCopied] = useState(false)
  const screen = currentScreen(project, activeScreenId)
  const layersKey = screen
    ? screen.children
        .map((node) =>
          [node.id, node.type, node.name, node.x, node.y, node.w, node.h, node.visible, node.color, node.fill, node.stroke, node.text, node.font, node.role].join(':')
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
  const assets = Array.isArray(project.assets) ? project.assets : []
  const usedIdents = new Set<string>()
  const shapeHeaders = screen.children
    .filter((node) => node.visible && node.role !== 'reference')
    .map((node) => {
      const { w, h } = nodeBounds(node)
      return { node, ident: toCIdentifier(node.name, usedIdents), w, h }
    })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard can be denied in embedded browsers */
    }
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
        <div className="flex h-9 shrink-0 items-center border-b border-line px-3">
          <h3 className="text-[11px] font-semibold text-ink">{t('editor.exportOptions')}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
          <div className="mb-2">
            <div className="mb-1 text-[11px] font-semibold text-ink">{t('editor.shapeHeaders')}</div>
            {shapeHeaders.length ? (
              <div className="grid gap-0.5">
                {shapeHeaders.map((item) => (
                  <div key={item.node.id} className="flex h-7 items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink" title={item.node.name}>
                      {item.ident}.h
                    </span>
                    <span className="shrink-0 text-[11px] text-muted tabular-nums">
                      {item.w}×{item.h}
                    </span>
                    <Tooltip content={t('editor.downloadHeader')}>
                      <IconButton
                        aria-label={`${t('editor.downloadHeader')} ${item.ident}.h`}
                        onClick={() => void downloadShapeHeader(item.node, item.ident)}
                      >
                        <Download size={14} strokeWidth={1.5} />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-muted">{t('editor.noShapeHeaders')}</div>
            )}
          </div>
          <div className="border-t border-line pt-2">
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
          {assets.length > 0 ? (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mb-1 text-[11px] font-semibold text-ink">{t('editor.images')}</div>
              {assets.map((asset, index) => (
                <div key={index} className="h-7 truncate text-[12px] leading-7 text-ink">
                  {String((asset as { name?: string }).name ?? index)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] text-muted tabular-nums">
          {t('editor.bitmapBytes', { count: Math.ceil((project.device.width * project.device.height) / 8) })}
        </div>
      </aside>
    </div>
  )
}
