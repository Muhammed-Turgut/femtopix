import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip } from './Tooltip'

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  flush,
  scroll
}: {
  value: T
  options: { id: T; label: string; icon?: LucideIcon }[]
  onChange: (value: T) => void
  flush?: boolean
  scroll?: boolean
}) {
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scroll) return
    const root = bar.current
    const active = root?.querySelector<HTMLElement>('[data-active="true"]')
    if (!root || !active) return
    const left = active.offsetLeft
    const right = left + active.offsetWidth
    if (left < root.scrollLeft) root.scrollLeft = left
    else if (right > root.scrollLeft + root.clientWidth) root.scrollLeft = right - root.clientWidth
  }, [scroll, value])

  return (
    <div
      ref={bar}
      className={`flex h-8 ${scroll ? 'min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]' : ''} ${flush ? '' : 'border-b border-line'}`}
      onWheel={(event) => {
        const root = bar.current
        if (!scroll || !root || root.scrollWidth <= root.clientWidth) return
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
        root.scrollLeft += event.deltaY
      }}
    >
      {options.map((option) => {
        const Icon = option.icon
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            title={option.label}
            data-active={active ? 'true' : undefined}
            onClick={() => onChange(option.id)}
            className={`flex h-8 items-center justify-center px-2 text-[12px] ${
              scroll ? 'max-w-40 shrink-0 overflow-hidden' : 'min-w-0 flex-1'
            } ${active ? 'border-b-2 border-accent text-ink' : 'text-muted hover:text-ink'}`}
          >
            {Icon ? (
              <Tooltip content={option.label}>
                <span className="flex items-center">
                  <Icon size={16} strokeWidth={1.5} />
                </span>
              </Tooltip>
            ) : (
              <span className="min-w-0 truncate">{option.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
