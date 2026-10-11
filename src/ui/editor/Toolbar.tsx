import { ChevronDown, Circle, Eraser, Hand, Hexagon, Image as ImageIcon, Minus, MousePointer2, Pencil, Pipette, Square, Triangle, Type } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, type ToolId } from '@/store/app-store'
import { IconButton, Kbd, Tooltip } from '@/ui/primitives'

const SHAPES: { id: Extract<ToolId, 'rect' | 'ellipse' | 'line' | 'triangle' | 'polygon'>; icon: typeof Square; key: string }[] = [
  { id: 'rect', icon: Square, key: 'R' },
  { id: 'ellipse', icon: Circle, key: 'O' },
  { id: 'line', icon: Minus, key: 'L' },
  { id: 'triangle', icon: Triangle, key: 'Y' },
  { id: 'polygon', icon: Hexagon, key: 'P' }
]

export function Toolbar() {
  const { t } = useTranslation()
  const tool = useAppStore((s) => s.tool)
  const [shape, setShape] = useState<(typeof SHAPES)[number]['id']>('rect')
  const [open, setOpen] = useState(false)
  const ShapeIcon = SHAPES.find((item) => item.id === shape)?.icon ?? Square
  const shapeActive = SHAPES.some((item) => item.id === tool)

  return (
    <div className="absolute top-3 left-1/2 z-10 flex h-10 -translate-x-1/2 items-center gap-1 rounded-md border border-line bg-panel px-1">
      <Group>
        <ToolButton id="select" shortcut="V" icon={MousePointer2} />
        <ToolButton id="hand" shortcut="H" icon={Hand} />
      </Group>
      <Rule />
      <Group>
        <ToolButton id="image" shortcut="I" icon={ImageIcon} />
        <ToolButton id="pencil" shortcut="B" icon={Pencil} />
        <ToolButton id="eraser" shortcut="E" icon={Eraser} />
      </Group>
      <Rule />
      <Group>
        <ToolButton id="text" shortcut="T" icon={Type} />
      </Group>
      <Rule />
      <div className="relative flex items-center">
        <Tooltip
          side="bottom"
          content={
            <span className="flex items-center gap-1">
              {t(`tools.${shape}`)} <Kbd>{SHAPES.find((item) => item.id === shape)?.key}</Kbd>
            </span>
          }
        >
          <IconButton active={shapeActive} onClick={() => useAppStore.getState().setTool(shape)}>
            <ShapeIcon size={16} strokeWidth={1.5} />
          </IconButton>
        </Tooltip>
        <IconButton aria-label={t('editor.shapes')} onClick={() => setOpen((value) => !value)}>
          <ChevronDown size={16} strokeWidth={1.5} />
        </IconButton>
        {open ? (
          <div
            className="absolute top-11 left-0 rounded-md border border-line bg-panel p-1"
          >
            {SHAPES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex h-7 w-full items-center gap-2 px-2 text-left ${
                    item.id === tool ? 'bg-accent text-on-accent' : 'hover:bg-hover'
                  }`}
                  onClick={() => {
                    setShape(item.id)
                    useAppStore.getState().setTool(item.id)
                    setOpen(false)
                  }}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span className="flex-1 text-[12px]">{t(`tools.${item.id}`)}</span>
                  <Kbd>{item.key}</Kbd>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <Rule />
      <Group>
        <ToolButton id="eyedropper" shortcut="K" icon={Pipette} />
      </Group>
    </div>
  )
}

function ToolButton({ id, shortcut, icon: Icon }: { id: ToolId; shortcut: string; icon: typeof Square }) {
  const { t } = useTranslation()
  const tool = useAppStore((s) => s.tool)
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="flex items-center gap-1">
          {t(`tools.${id}`)} <Kbd>{shortcut}</Kbd>
        </span>
      }
    >
      <IconButton active={tool === id} onClick={() => useAppStore.getState().setTool(id)}>
        <Icon size={16} strokeWidth={1.5} />
      </IconButton>
    </Tooltip>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center">{children}</div>
}

function Rule() {
  return <div className="mx-0.5 h-6 w-px bg-line" />
}
