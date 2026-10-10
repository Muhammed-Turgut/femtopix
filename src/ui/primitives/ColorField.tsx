import { RGB565_SWATCHES, expandRgb565, snapHexToRgb565 } from '@/core/color/rgb565'
import { Input } from '@/ui/primitives/Input'

export function ColorField({
  value,
  onChange
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const hex = snapHexToRgb565(value.startsWith('#') ? value : '#ffffff')

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={hex}
          aria-label="RGB565"
          onChange={(event) => onChange(snapHexToRgb565(event.target.value))}
          className="size-7 cursor-pointer rounded border border-line bg-transparent p-0"
        />
        <Input
          value={hex.toUpperCase()}
          spellCheck={false}
          className="font-mono uppercase"
          onChange={(event) => {
            const next = event.target.value.trim()
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(snapHexToRgb565(next))
          }}
          onBlur={(event) => {
            const next = event.target.value.trim()
            onChange(snapHexToRgb565(/^#[0-9a-fA-F]{3,6}$/.test(next) ? next : hex))
          }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {RGB565_SWATCHES.map((swatch) => {
          const item = expandRgb565(swatch)
          const active = hex.toLowerCase() === item.toLowerCase()
          return (
            <button
              key={swatch}
              type="button"
              aria-label={item}
              title={item.toUpperCase()}
              onClick={() => onChange(item)}
              className={`size-5 rounded border ${active ? 'border-accent' : 'border-line'}`}
              style={{ background: item }}
            />
          )
        })}
      </div>
    </div>
  )
}
