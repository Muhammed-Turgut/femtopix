import {
  Box,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Images,
  Layers,
  Lock,
  LockOpen,
  Monitor,
  Plus,
  Search,
  Square,
  Trash2,
  Type,
  Circle
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SceneNode } from '@/core/document/model'
import { currentScreen, useAppStore, type LeftTab } from '@/store/app-store'
import { duplicateSelection } from '@/ui/editor/edit-actions'
import {
  duplicateScreen,
  moveNode,
  removeNodes,
  removeScreen,
  renameNode,
  renameScreen,
  setSelectedIds,
  toggleNodeFlag
} from '@/ui/editor/document-actions'
import { GalleryPanel } from '@/ui/editor/GalleryPanel'
import { Button, EmptyState, IconButton, Input, Tabs, Tooltip } from '@/ui/primitives'

function nodeIcon(type: SceneNode['type']) {
  if (type === 'text') return Type
  if (type === 'image' || type === 'paint') return ImageIcon
  if (type === 'ellipse') return Circle
  if (type === 'group') return Layers
  return Square
}

export function LeftPanel() {
  const { t } = useTranslation()
  const document = useAppStore((s) => s.document)
  const leftTab = useAppStore((s) => s.leftTab)
  const activeScreenId = useAppStore((s) => s.activeScreenId)
  const selectedIds = useAppStore((s) => s.selectedIds)
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editingScreen, setEditingScreen] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; kind: 'layer' | 'screen' } | null>(null)
  const [screensOpen, setScreensOpen] = useState(true)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const screen = currentScreen(document, activeScreenId)
  const layers = useMemo(() => {
    const children = screen?.children ?? []
    if (!query.trim()) return children
    return children.filter((node) => node.name.toLowerCase().includes(query.toLowerCase()))
  }, [query, screen])

  if (!document || !screen) return null

  return (
    <div className="flex h-full flex-col bg-panel" onClick={() => setMenu(null)}>
      <Tabs
        value={leftTab}
        onChange={(tab) => useAppStore.getState().setLeftTab(tab)}
        options={[
          { id: 'layers' as LeftTab, label: t('editor.layers'), icon: Layers },
          { id: 'screens' as LeftTab, label: t('editor.screens'), icon: Monitor },
          { id: 'assets' as LeftTab, label: t('editor.assets'), icon: ImageIcon },
          { id: 'components' as LeftTab, label: t('editor.components'), icon: Box },
          { id: 'gallery' as LeftTab, label: t('editor.gallery'), icon: Images }
        ]}
      />

      {leftTab === 'layers' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-8 items-center justify-between border-b border-line px-3">
            <button type="button" className="text-[11px] font-semibold text-ink" onClick={() => setScreensOpen((v) => !v)}>
              {t('editor.screens')}
            </button>
            <Tooltip content={t('editor.addScreen')}>
              <IconButton onClick={() => useAppStore.getState().addScreen()}>
                <Plus size={16} strokeWidth={1.5} />
              </IconButton>
            </Tooltip>
          </div>
          {screensOpen
            ? document.screens.map((item) => (
                <ScreenRow
                  key={item.id}
                  name={item.name}
                  size={`${document.device.width}×${document.device.height}`}
                  active={item.id === activeScreenId}
                  editing={editingScreen === item.id}
                  canDelete={document.screens.length > 1}
                  onSelect={() => useAppStore.getState().setActiveScreen(item.id)}
                  onRename={(name) => {
                    renameScreen(item.id, name.trim() || t('editor.screen'))
                    setEditingScreen(null)
                  }}
                  onEdit={() => setEditingScreen(item.id)}
                  onCancelEdit={() => setEditingScreen(null)}
                  onDuplicate={() => duplicateScreen(item.id)}
                  onDelete={() => {
                    if (!removeScreen(item.id)) useAppStore.getState().showToast(t('editor.lastScreen'))
                  }}
                  onMenu={(x, y) => {
                    useAppStore.getState().setActiveScreen(item.id)
                    setMenu({ kind: 'screen', x, y, id: item.id })
                  }}
                  labels={{
                    duplicate: t('editor.duplicateScreen'),
                    remove: t('editor.deleteScreen')
                  }}
                />
              ))
            : null}

          <div className="flex h-8 items-center justify-between border-t border-line px-2">
            <span className="text-[11px] font-semibold">{t('editor.layers')}</span>
            <IconButton active={filterOpen} onClick={() => setFilterOpen((v) => !v)} aria-label={t('editor.searchLayers')}>
              <Search size={16} strokeWidth={1.5} />
            </IconButton>
          </div>
          {filterOpen ? (
            <div className="px-2 pb-2">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('editor.searchLayers')} />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto">
            {layers.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t('editor.emptyLayersTitle')}
                body={t('editor.emptyLayersBody')}
                action={
                  <Button onClick={() => useAppStore.getState().setTool('rect')}>{t('editor.addShape')}</Button>
                }
              />
            ) : (
              layers.map((node, index) => {
                const Icon = nodeIcon(node.type)
                const selected = selectedIds.includes(node.id)
                return (
                  <div key={node.id} className="relative">
                    {dropIndex === index ? <div className="absolute top-0 right-0 left-0 z-10 h-0.5 bg-accent" /> : null}
                    <div
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDropIndex(index)
                      }}
                      onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                      onDrop={(event) => {
                        event.preventDefault()
                        moveNode(screen.id, Number(event.dataTransfer.getData('text/plain')), index)
                        setDropIndex(null)
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (event.shiftKey || event.ctrlKey || event.metaKey) {
                          setSelectedIds(selected ? selectedIds.filter((id) => id !== node.id) : [...selectedIds, node.id])
                        } else {
                          setSelectedIds([node.id])
                        }
                      }}
                      onDoubleClick={() => setEditing(node.id)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setSelectedIds([node.id])
                        setMenu({ kind: 'layer', x: event.clientX, y: event.clientY, id: node.id })
                      }}
                      className={`group flex h-7 items-center gap-1 px-2 ${selected ? 'bg-selected' : 'hover:bg-hover'}`}
                    >
                      <Icon size={16} strokeWidth={1.5} className="text-muted" />
                      {editing === node.id ? (
                        <Input
                          autoFocus
                          defaultValue={node.name}
                          onBlur={(event) => {
                            renameNode(screen.id, node.id, event.target.value)
                            setEditing(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                            if (event.key === 'Escape') setEditing(null)
                          }}
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-[12px]">{node.name}</span>
                      )}
                      <button
                        type="button"
                        className={`${node.visible ? 'hidden text-muted group-hover:block' : 'text-ink'} hover:text-ink`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleNodeFlag(screen.id, node.id, 'visible')
                        }}
                      >
                        {node.visible ? <Eye size={16} strokeWidth={1.5} /> : <EyeOff size={16} strokeWidth={1.5} />}
                      </button>
                      <button
                        type="button"
                        className={`${node.locked ? 'text-ink' : 'hidden text-muted group-hover:block'} hover:text-ink`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleNodeFlag(screen.id, node.id, 'locked')
                        }}
                      >
                        {node.locked ? <Lock size={16} strokeWidth={1.5} /> : <LockOpen size={16} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {leftTab === 'screens' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="p-2">
            <Button onClick={() => useAppStore.getState().addScreen()}>{t('editor.addScreen')}</Button>
          </div>
          {document.screens.map((item) => (
            <ScreenRow
              key={item.id}
              name={item.name}
              size={`${document.device.width}×${document.device.height}`}
              active={item.id === activeScreenId}
              editing={editingScreen === item.id}
              canDelete={document.screens.length > 1}
              onSelect={() => useAppStore.getState().setActiveScreen(item.id)}
              onRename={(name) => {
                renameScreen(item.id, name.trim() || t('editor.screen'))
                setEditingScreen(null)
              }}
              onEdit={() => setEditingScreen(item.id)}
              onCancelEdit={() => setEditingScreen(null)}
              onDuplicate={() => duplicateScreen(item.id)}
              onDelete={() => {
                if (!removeScreen(item.id)) useAppStore.getState().showToast(t('editor.lastScreen'))
              }}
              onMenu={(x, y) => {
                useAppStore.getState().setActiveScreen(item.id)
                setMenu({ kind: 'screen', x, y, id: item.id })
              }}
              labels={{
                duplicate: t('editor.duplicateScreen'),
                remove: t('editor.deleteScreen')
              }}
            />
          ))}
        </div>
      ) : null}

      {leftTab === 'gallery' ? <GalleryPanel /> : null}

      {leftTab === 'assets' ? (
        <EmptyState
          icon={ImageIcon}
          title={t('editor.emptyAssetsTitle')}
          body={t('editor.emptyAssetsBody')}
          action={<Button onClick={() => useAppStore.getState().setTool('image')}>{t('editor.addImage')}</Button>}
        />
      ) : null}
      {leftTab === 'components' ? (
        <EmptyState
          icon={Box}
          title={t('editor.emptyComponentsTitle')}
          body={t('editor.emptyComponentsBody')}
          action={
            <Button disabled={selectedIds.length === 0}>{t('editor.createComponent')}</Button>
          }
        />
      ) : null}

      {menu ? (
        <div
          className="fixed z-50 min-w-32 rounded-md border border-line bg-panel py-1"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="flex h-7 w-full items-center px-3 text-left hover:bg-hover"
            onClick={() => {
              if (menu.kind === 'screen') setEditingScreen(menu.id)
              else setEditing(menu.id)
              setMenu(null)
            }}
          >
            {t('editor.name')}
          </button>
          <button
            type="button"
            className="flex h-7 w-full items-center px-3 text-left hover:bg-hover"
            onClick={() => {
              if (menu.kind === 'screen') duplicateScreen(menu.id)
              else {
                setSelectedIds([menu.id])
                duplicateSelection()
              }
              setMenu(null)
            }}
          >
            {menu.kind === 'screen' ? t('editor.duplicateScreen') : t('editor.duplicate')}
          </button>
          <button
            type="button"
            className={`flex h-7 w-full items-center px-3 text-left hover:bg-hover ${
              menu.kind === 'screen' && document.screens.length <= 1 ? 'opacity-40' : ''
            }`}
            onClick={() => {
              if (menu.kind === 'screen') {
                if (!removeScreen(menu.id)) useAppStore.getState().showToast(t('editor.lastScreen'))
              } else if (activeScreenId) {
                removeNodes(activeScreenId, [menu.id])
              }
              setMenu(null)
            }}
          >
            {menu.kind === 'screen' ? t('editor.deleteScreen') : t('editor.delete')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ScreenRow({
  name,
  size,
  active,
  editing,
  canDelete,
  onSelect,
  onRename,
  onEdit,
  onCancelEdit,
  onDuplicate,
  onDelete,
  onMenu,
  labels
}: {
  name: string
  size: string
  active: boolean
  editing: boolean
  canDelete: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onEdit: () => void
  onCancelEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMenu: (x: number, y: number) => void
  labels: { duplicate: string; remove: string }
}) {
  return (
    <div
      className={`group flex h-7 items-center gap-1 px-2 ${active ? 'bg-selected' : 'hover:bg-hover'}`}
      onClick={onSelect}
      onDoubleClick={onEdit}
      onContextMenu={(event) => {
        event.preventDefault()
        onMenu(event.clientX, event.clientY)
      }}
    >
      {editing ? (
        <Input
          autoFocus
          defaultValue={name}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
            if (event.key === 'Escape') onCancelEdit()
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[12px]">{name}</span>
      )}
      <span className="text-[11px] text-muted tabular-nums group-hover:hidden">{size}</span>
      <Tooltip content={labels.duplicate}>
        <IconButton
          className="opacity-0 group-hover:opacity-100"
          aria-label={labels.duplicate}
          onClick={(event) => {
            event.stopPropagation()
            onDuplicate()
          }}
        >
          <Copy size={14} strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
      <Tooltip content={labels.remove}>
        <IconButton
          className="opacity-0 group-hover:opacity-100"
          aria-label={labels.remove}
          disabled={!canDelete}
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
    </div>
  )
}
