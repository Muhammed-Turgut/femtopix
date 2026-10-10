import { useEffect, useId, useRef, useState, type PropsWithChildren, type ReactNode } from 'react'

export function Tooltip({
  content,
  children
}: PropsWithChildren<{ content: ReactNode }>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<number>(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        timer.current = window.setTimeout(() => setOpen(true), 500)
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current)
        setOpen(false)
      }}
    >
      {children}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-ink"
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
