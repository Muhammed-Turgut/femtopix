export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}) {
  return (
    <label className="flex min-h-7 items-center justify-between gap-3">
      {label ? <span className="min-w-0 flex-1 text-[12px] leading-4 text-ink">{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 shrink-0 rounded ${checked ? 'bg-accent' : 'bg-elevated'}`}
      >
        <span className={`absolute top-0.5 size-3 rounded-sm ${checked ? 'left-3.5 bg-on-accent' : 'left-0.5 bg-ink'}`} />
      </button>
    </label>
  )
}
