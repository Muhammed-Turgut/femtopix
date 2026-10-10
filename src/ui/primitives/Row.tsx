import type { PropsWithChildren } from 'react'

export function Row({ children }: PropsWithChildren) {
  return <div className="flex h-7 items-center gap-2">{children}</div>
}

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div className="grid gap-1">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      {children}
    </div>
  )
}
