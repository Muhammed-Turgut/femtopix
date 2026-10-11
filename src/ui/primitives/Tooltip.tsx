import { useEffect, useId, useRef, useState, type PropsWithChildren, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Tooltip({
  content,
  children,
  side = 'top'
}: PropsWithChildren<{ content: ReactNode; side?: 'top' | 'bottom' }>) {
  const id = useId()
  const wrap = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<DOMRect | null>(null)
  const timer = useRef<number>(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const show = () => {
    timer.current = window.setTimeout(() => {
      setBox(wrap.current?.getBoundingClientRect() ?? null)
      setOpen(true)
    }, 400)
  }

  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <span ref={wrap} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {open && box
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-[200] whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-ink"
              style={{
                left: box.left + box.width / 2,
                top: side === 'bottom' ? box.bottom + 6 : box.top - 6,
                transform: side === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
              }}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  )
}
