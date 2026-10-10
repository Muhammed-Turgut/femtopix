import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  value,
  options,
  onChange
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<DOMRect | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value)?.label ?? value

  const place = () => {
    if (button.current) setBox(button.current.getBoundingClientRect())
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (button.current?.contains(target) || menu.current?.contains(target)) return
      setOpen(false)
    }
    const onReposition = () => place()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  const flip = box ? box.bottom + 4 + options.length * 28 > window.innerHeight : false

  return (
    <div className="relative w-full">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-6 w-full items-center justify-between rounded border border-transparent bg-input px-2 text-left text-[12px] text-ink hover:border-line focus-visible:border-accent"
      >
        <span className="truncate">{current}</span>
        <ChevronDown size={16} strokeWidth={1.5} className="text-muted" />
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menu}
              data-select-menu=""
              className="fixed z-50 overflow-hidden rounded-md border border-line bg-panel"
              style={{
                top: flip ? undefined : box.bottom + 4,
                bottom: flip ? window.innerHeight - box.top + 4 : undefined,
                left: box.left,
                width: Math.max(box.width, 160)
              }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex h-7 w-full items-center px-2 text-left text-[12px] ${
                    option.value === value ? 'bg-selected text-ink' : 'text-ink hover:bg-hover'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
