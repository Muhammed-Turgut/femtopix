import type { PropsWithChildren } from 'react'

export function Kbd({ children }: PropsWithChildren) {
  return (
    <kbd className="inline-flex h-5 items-center rounded border border-line bg-elevated px-1 font-mono text-[11px] text-ink">
      {children}
    </kbd>
  )
}
