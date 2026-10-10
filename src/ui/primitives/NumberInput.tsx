import { useRef, useState } from 'react'

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  const drag = useRef<{ x: number; start: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)

  const clamp = (next: number) => {
    let result = Math.round(next)
    if (min !== undefined) result = Math.max(min, result)
    if (max !== undefined) result = Math.min(max, result)
    return result
  }

  const commit = (raw: string) => {
    if (raw.trim() === '' || raw === '-') {
      setDraft(raw)
      return
    }
    const next = Number(raw)
    if (Number.isNaN(next)) {
      setDraft(String(value))
      return
    }
    onChange(clamp(next))
    setDraft(null)
  }

  return (
    <div className="flex h-6 items-center rounded border border-transparent bg-input hover:border-line focus-within:border-accent">
      <span
        className="cursor-ew-resize px-1.5 text-[11px] text-muted"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, start: value }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          onChange(clamp(drag.current.start + event.clientX - drag.current.x))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        className="h-full w-full select-text bg-transparent pr-1.5 text-[12px] text-ink tabular-nums outline-none"
        value={draft ?? (Number.isFinite(value) ? String(value) : '')}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => {
          if (draft === null) return
          const next = Number(draft)
          onChange(Number.isNaN(next) ? value : clamp(next))
          setDraft(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        }}
      />
    </div>
  )
}
