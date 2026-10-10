import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="grid h-full place-items-center px-4 text-center">
      <div className="grid max-w-[200px] justify-items-center gap-2">
        <Icon size={16} strokeWidth={1.5} className="text-muted" />
        <div className="text-[12px] font-medium text-ink">{title}</div>
        {body ? <p className="text-[11px] text-muted">{body}</p> : null}
        {action}
      </div>
    </div>
  )
}
