import type { LucideIcon } from 'lucide-react'
import { Tooltip } from './Tooltip'

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  flush
}: {
  value: T
  options: { id: T; label: string; icon?: LucideIcon }[]
  onChange: (value: T) => void
  flush?: boolean
}) {
  const compact = options.some((option) => option.icon)

  return (
    <div className={`flex h-8 ${flush ? '' : 'border-b border-line'}`}>
      {options.map((option) => {
        const Icon = option.icon
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            title={option.label}
            onClick={() => onChange(option.id)}
            className={`flex h-8 min-w-0 items-center justify-center px-2 text-[12px] ${
              compact ? 'flex-1' : 'flex-1 truncate'
            } ${active ? 'border-b-2 border-accent text-ink' : 'text-muted hover:text-ink'}`}
          >
            {Icon ? (
              <Tooltip content={option.label}>
                <span className="flex items-center">
                  <Icon size={16} strokeWidth={1.5} />
                </span>
              </Tooltip>
            ) : (
              option.label
            )}
          </button>
        )
      })}
    </div>
  )
}
