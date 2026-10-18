import {
  Box,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
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
  Type
} from 'lucide-react'
import { useMemo, useState, type Dispatch, type DragEvent as ReactDragEvent, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { IvecDocument, SceneNode } from '@/core/document/model'
import { currentScreen, useAppStore, type LeftTab } from '@/store/app-store'
import { duplicateSelection } from '@/ui/editor/edit-actions'
import {
  addFolder,
  duplicateScreen,
  moveNode,
  removeFolder,
  removeNodes,
  removeScreen,
  renameFolder,
  renameNode,
  renameScreen,
  setScreenFolder,
  setSelectedIds,
  toggleFolder,
  toggleNodeFlag
} from '@/ui/editor/document-actions'
import { GalleryPanel } from '@/ui/editor/GalleryPanel'
import { Button, EmptyState, IconButton, Input, Tabs, Tooltip } from '@/ui/primitives'

const SCREEN_DRAG = 'application/x-ivec-screen'

function acceptScreenDrag(event: ReactDragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(SCREEN_DRAG)
}

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
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; kind: 'layer' | 'screen' | 'folder' } | null>(null)
  const [screensOpen, setScreensOpen] = useState(true)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const screen = currentScreen(document, activeScreenId)
  const layers = useMemo(() => {
    const children = screen?.children ?? []
    if (!query.trim()) return children
    return children.filter((node) => node.name.toLowerCase().includes(query.toLowerCase()))
  }, [query, screen])

  if (!document || !screen) return null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-panel" onClick={() => setMenu(null)}>
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
          <div
            className={`flex h-8 items-center justify-between border-b border-line px-3 ${dropTarget === 'loose' ? 'bg-hover' : ''}`}
            onDragOver={(event) => {
              if (!acceptScreenDrag(event)) return
              event.preventDefault()
              setDropTarget('loose')
            }}
            onDragLeave={() => setDropTarget((current) => (current === 'loose' ? null : current))}
            onDrop={(event) => {
              const id = event.dataTransfer.getData(SCREEN_DRAG)
              if (!id) return
              event.preventDefault()
              setScreenFolder(id, null)
              setDropTarget(null)
            }}
          >
            <button type="button" className="text-[11px] font-semibold text-ink" onClick={() => setScreensOpen((v) => !v)}>
              {t('editor.screens')}
            </button>
            <div className="flex items-center">
              <Tooltip content={t('editor.addFolder')}>
                <IconButton
                  aria-label={t('editor.addFolder')}
                  onClick={() => setEditingFolder(addFolder())}
                >
                  <FolderPlus size={16} strokeWidth={1.5} />
                </IconButton>
              </Tooltip>
              <Tooltip content={t('editor.addScreen')}>
                <IconButton aria-label={t('editor.addScreen')} onClick={() => useAppStore.getState().addScreen()}>
                  <Plus size={16} strokeWidth={1.5} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          {screensOpen ? (
            <div className="max-h-[45%] min-h-0 overflow-auto">
              <ScreenBrowser
                document={document}
                activeScreenId={activeScreenId}
                editingScreen={editingScreen}
                editingFolder={editingFolder}
                dropTarget={dropTarget}
                onEditScreen={setEditingScreen}
                onEditFolder={setEditingFolder}
                onDropTarget={setDropTarget}
                onMenu={(kind, id, x, y) => {
                  if (kind === 'screen') useAppStore.getState().setActiveScreen(id)
                  setMenu({ kind, x, y, id })
                }}
              />
            </div>
          ) : null}

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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={`flex gap-1 p-2 ${dropTarget === 'loose' ? 'bg-hover' : ''}`}
            onDragOver={(event) => {
              if (!acceptScreenDrag(event)) return
              event.preventDefault()
              setDropTarget('loose')
            }}
            onDragLeave={() => setDropTarget((current) => (current === 'loose' ? null : current))}
            onDrop={(event) => {
              const id = event.dataTransfer.getData(SCREEN_DRAG)
              if (!id) return
              event.preventDefault()
              setScreenFolder(id, null)
              setDropTarget(null)
            }}
          >
            <Button className="min-w-0 flex-1 px-1" onClick={() => setEditingFolder(addFolder())}>
              <FolderPlus size={16} strokeWidth={1.5} />
              <span className="truncate">{t('editor.addFolder')}</span>
            </Button>
            <Button className="min-w-0 flex-1 px-1" onClick={() => useAppStore.getState().addScreen()}>
              <span className="truncate">{t('editor.addScreen')}</span>
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <ScreenBrowser
              document={document}
              activeScreenId={activeScreenId}
              editingScreen={editingScreen}
              editingFolder={editingFolder}
              dropTarget={dropTarget}
              onEditScreen={setEditingScreen}
              onEditFolder={setEditingFolder}
              onDropTarget={setDropTarget}
              onMenu={(kind, id, x, y) => {
                if (kind === 'screen') useAppStore.getState().setActiveScreen(id)
                setMenu({ kind, x, y, id })
              }}
            />
          </div>
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
          className="fixed z-50 min-w-36 rounded-md border border-line bg-panel py-1"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.kind === 'folder' ? (
            <>
              <MenuItem
                label={t('editor.name')}
                onClick={() => {
                  setEditingFolder(menu.id)
                  setMenu(null)
                }}
              />
              <MenuItem
                label={t('editor.deleteFolder')}
                onClick={() => {
                  removeFolder(menu.id)
                  setMenu(null)
                }}
              />
            </>
          ) : (
            <>
              <MenuItem
                label={t('editor.name')}
                onClick={() => {
                  if (menu.kind === 'screen') setEditingScreen(menu.id)
                  else setEditing(menu.id)
                  setMenu(null)
                }}
              />
              <MenuItem
                label={menu.kind === 'screen' ? t('editor.duplicateScreen') : t('editor.duplicate')}
                onClick={() => {
                  if (menu.kind === 'screen') duplicateScreen(menu.id)
                  else {
                    setSelectedIds([menu.id])
                    duplicateSelection()
                  }
                  setMenu(null)
                }}
              />
              {menu.kind === 'screen' && (document.folders ?? []).length > 0 ? (
                <div className="px-3 pt-1 text-[10px] text-muted">{t('editor.moveToFolder')}</div>
              ) : null}
              {menu.kind === 'screen'
                ? (document.folders ?? []).map((folder) => (
                    <MenuItem
                      key={folder.id}
                      label={folder.name}
                      onClick={() => {
                        setScreenFolder(menu.id, folder.id)
                        setMenu(null)
                      }}
                    />
                  ))
                : null}
              {menu.kind === 'screen' && document.screens.find((item) => item.id === menu.id)?.folderId ? (
                <MenuItem
                  label={t('editor.removeFromFolder')}
                  onClick={() => {
                    setScreenFolder(menu.id, null)
                    setMenu(null)
                  }}
                />
              ) : null}
              <MenuItem
                label={menu.kind === 'screen' ? t('editor.deleteScreen') : t('editor.delete')}
                disabled={menu.kind === 'screen' && document.screens.length <= 1}
                onClick={() => {
                  if (menu.kind === 'screen') {
                    if (!removeScreen(menu.id)) useAppStore.getState().showToast(t('editor.lastScreen'))
                  } else if (activeScreenId) {
                    removeNodes(activeScreenId, [menu.id])
                  }
                  setMenu(null)
                }}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex h-7 w-full items-center px-3 text-left hover:bg-hover ${disabled ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function ScreenBrowser({
  document,
  activeScreenId,
  editingScreen,
  editingFolder,
  dropTarget,
  onEditScreen,
  onEditFolder,
  onDropTarget,
  onMenu
}: {
  document: IvecDocument
  activeScreenId: string | null
  editingScreen: string | null
  editingFolder: string | null
  dropTarget: string | null
  onEditScreen: (id: string | null) => void
  onEditFolder: (id: string | null) => void
  onDropTarget: Dispatch<SetStateAction<string | null>>
  onMenu: (kind: 'screen' | 'folder', id: string, x: number, y: number) => void
}) {
  const { t } = useTranslation()
  const folders = document.folders ?? []
  const folderIds = new Set(folders.map((folder) => folder.id))
  const loose = document.screens.filter((screen) => !screen.folderId || !folderIds.has(screen.folderId))
  const size = `${document.device.width}×${document.device.height}`
  const labels = { duplicate: t('editor.duplicateScreen'), remove: t('editor.deleteScreen') }

  const screenRow = (item: (typeof document.screens)[number], nested: boolean) => (
    <ScreenRow
      key={item.id}
      name={item.name}
      size={size}
      active={item.id === activeScreenId}
      editing={editingScreen === item.id}
      canDelete={document.screens.length > 1}
      nested={nested}
      dropActive={dropTarget === item.id}
      onSelect={() => useAppStore.getState().setActiveScreen(item.id)}
      onRename={(name) => {
        renameScreen(item.id, name.trim() || t('editor.screen'))
        onEditScreen(null)
      }}
      onEdit={() => onEditScreen(item.id)}
      onCancelEdit={() => onEditScreen(null)}
      onDuplicate={() => duplicateScreen(item.id)}
      onDelete={() => {
        if (!removeScreen(item.id)) useAppStore.getState().showToast(t('editor.lastScreen'))
      }}
      onMenu={(x, y) => onMenu('screen', item.id, x, y)}
      onDragStart={(event) => {
        event.dataTransfer.setData(SCREEN_DRAG, item.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => {
        if (!acceptScreenDrag(event)) return
        event.preventDefault()
        event.stopPropagation()
        onDropTarget(item.id)
      }}
      onDragLeave={() => onDropTarget((current) => (current === item.id ? null : current))}
      onDrop={(event) => {
        const id = event.dataTransfer.getData(SCREEN_DRAG)
        event.preventDefault()
        event.stopPropagation()
        if (id && id !== item.id) setScreenFolder(id, item.folderId ?? null)
        onDropTarget(null)
      }}
      labels={labels}
    />
  )

  return (
    <>
      {folders.map((folder) => {
        const children = document.screens.filter((screen) => screen.folderId === folder.id)
        return (
          <div key={folder.id}>
            <div
              className={`group flex h-7 items-center gap-1 px-2 ${dropTarget === folder.id ? 'bg-hover' : 'hover:bg-hover'}`}
              onClick={() => {
                if (editingFolder !== folder.id) toggleFolder(folder.id)
              }}
              onDoubleClick={(event) => {
                event.stopPropagation()
                onEditFolder(folder.id)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onMenu('folder', folder.id, event.clientX, event.clientY)
              }}
              onDragOver={(event) => {
                if (!acceptScreenDrag(event)) return
                event.preventDefault()
                onDropTarget(folder.id)
              }}
              onDragLeave={() => onDropTarget((current) => (current === folder.id ? null : current))}
              onDrop={(event) => {
                const id = event.dataTransfer.getData(SCREEN_DRAG)
                event.preventDefault()
                if (id) setScreenFolder(id, folder.id)
                onDropTarget(null)
              }}
            >
              {folder.collapsed ? (
                <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
              ) : (
                <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
              )}
              <Folder size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
              {editingFolder === folder.id ? (
                <Input
                  autoFocus
                  defaultValue={folder.name}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    renameFolder(folder.id, event.target.value.trim() || t('editor.folder'))
                    onEditFolder(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                    if (event.key === 'Escape') onEditFolder(null)
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[12px]">{folder.name}</span>
              )}
              <Tooltip content={t('editor.addScreen')}>
                <IconButton
                  className="opacity-0 group-hover:opacity-100"
                  aria-label={t('editor.addScreen')}
                  onClick={(event) => {
                    event.stopPropagation()
                    useAppStore.getState().addScreen(folder.id)
                  }}
                >
                  <Plus size={14} strokeWidth={1.5} />
                </IconButton>
              </Tooltip>
            </div>
            {folder.collapsed ? null : children.length === 0 ? (
              <div
                className={`px-7 py-1 text-[11px] text-muted ${dropTarget === folder.id ? 'bg-hover' : ''}`}
                onDragOver={(event) => {
                  if (!acceptScreenDrag(event)) return
                  event.preventDefault()
                  onDropTarget(folder.id)
                }}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData(SCREEN_DRAG)
                  event.preventDefault()
                  if (id) setScreenFolder(id, folder.id)
                  onDropTarget(null)
                }}
              >
                {t('editor.emptyFolder')}
              </div>
            ) : (
              children.map((item) => screenRow(item, true))
            )}
          </div>
        )
      })}
      {loose.map((item) => screenRow(item, false))}
    </>
  )
}

function ScreenRow({
  name,
  size,
  active,
  editing,
  canDelete,
  nested,
  dropActive,
  onSelect,
  onRename,
  onEdit,
  onCancelEdit,
  onDuplicate,
  onDelete,
  onMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  labels
}: {
  name: string
  size: string
  active: boolean
  editing: boolean
  canDelete: boolean
  nested?: boolean
  dropActive?: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onEdit: () => void
  onCancelEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMenu: (x: number, y: number) => void
  onDragStart: (event: ReactDragEvent<HTMLDivElement>) => void
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void
  labels: { duplicate: string; remove: string }
}) {
  return (
    <div
      draggable={!editing}
      className={`group flex h-7 items-center gap-1 pr-2 ${nested ? 'pl-7' : 'pl-2'} ${dropActive ? 'bg-hover' : active ? 'bg-selected' : 'hover:bg-hover'}`}
      onClick={onSelect}
      onDoubleClick={onEdit}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
