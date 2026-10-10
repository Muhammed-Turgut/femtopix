const KEYWORDS = new Set([
  'void',
  'int',
  'char',
  'const',
  'static',
  'return',
  'if',
  'else',
  'for',
  'while',
  'true',
  'false'
])

function highlight(line: string) {
  if (line.includes('ivec:begin') || line.includes('ivec:end')) {
    return <span style={{ color: 'var(--code-comment)' }}>{line || ' '}</span>
  }
  if (line.trim().startsWith('//')) {
    return <span style={{ color: 'var(--code-comment)' }}>{line}</span>
  }

  const parts = line.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b)/)
  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null
        if (part.startsWith('"') || part.startsWith("'")) {
          return (
            <span key={index} style={{ color: 'var(--code-string)' }}>
              {part}
            </span>
          )
        }
        if (KEYWORDS.has(part)) {
          return (
            <span key={index} style={{ color: 'var(--code-keyword)' }}>
              {part}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function CodeView({ value }: { value: string }) {
  const lines = value.split('\n')

  return (
    <div className="scrollbar-thin h-full overflow-auto bg-input font-mono text-[12px] leading-[18px] text-ink">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td className="w-10 select-none pr-3 text-right text-muted tabular-nums">{index + 1}</td>
              <td className="whitespace-pre">{highlight(line)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
