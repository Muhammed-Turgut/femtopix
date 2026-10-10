import { Minus, Plus } from 'lucide-react'
import { useState, type PropsWithChildren } from 'react'

export function Section({ title, children, defaultOpen = true }: PropsWithChildren<{ title: string; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section>
      <div className="flex h-8 items-center justify-between border-b border-line px-3">
        <h3 className="text-[11px] font-semibold text-ink">{title}</h3>
        <button type="button" className="text-muted hover:text-ink" onClick={() => setOpen((value) => !value)}>
          {open ? <Minus size={16} strokeWidth={1.5} /> : <Plus size={16} strokeWidth={1.5} />}
        </button>
      </div>
      {open ? <div className="grid gap-2 p-3">{children}</div> : null}
    </section>
  )
}
