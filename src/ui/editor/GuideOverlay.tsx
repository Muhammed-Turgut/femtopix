import type { GuideLine } from '@/core/document/guides'

export function GuideOverlay({
  lines,
  zoom,
  dim
}: {
  lines: GuideLine[]
  zoom: number
  dim?: boolean
}) {
  if (!lines.length) return null
  return (
    <div className="pointer-events-none absolute inset-0">
      {lines.map((line, index) => {
        const vertical = line.axis === 'x'
        const length = Math.max(1, (line.end - line.start) * zoom)
        return (
          <div
            key={`${line.axis}-${line.at}-${line.start}-${index}`}
            className="absolute"
            style={{
              left: vertical ? line.at * zoom : line.start * zoom,
              top: vertical ? line.start * zoom : line.at * zoom,
              width: vertical ? 1 : length,
              height: vertical ? length : 1,
              background: dim
                ? undefined
                : 'var(--snap-guide)',
              backgroundImage: dim
                ? vertical
                  ? 'repeating-linear-gradient(to bottom, var(--snap-guide) 0 3px, transparent 3px 7px)'
                  : 'repeating-linear-gradient(to right, var(--snap-guide) 0 3px, transparent 3px 7px)'
                : undefined,
              opacity: dim ? 0.45 : 1
            }}
          />
        )
      })}
    </div>
  )
}
