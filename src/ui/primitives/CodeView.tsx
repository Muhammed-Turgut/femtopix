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
  'false',
  'unsigned',
  'signed',
  'bool',
  'float',
  'double',
  'short',
  'long',
  'struct',
  'enum',
  'typedef',
  'sizeof',
  'extern',
  'inline',
  'class',
  'public',
  'private',
  'protected',
  'virtual',
  'namespace',
  'using',
  'new',
  'delete',
  'this',
  'nullptr'
])

const TYPES = new Set([
  'uint8_t',
  'uint16_t',
  'uint32_t',
  'int8_t',
  'int16_t',
  'int32_t',
  'size_t',
  'U8G2',
  'Adafruit_GFX',
  'TFT_eSPI',
  'Arduino_GFX',
  'PROGMEM'
])

export type CodeKind = 'text' | 'comment' | 'string' | 'keyword' | 'fn' | 'number' | 'type'

const TOKEN =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*|0x[0-9a-fA-F]+[uUlL]*|\b\d+\b|\b[A-Za-z_]\w*\b)/

const COLOR: Record<Exclude<CodeKind, 'text'>, string> = {
  comment: 'var(--code-comment)',
  string: 'var(--code-string)',
  keyword: 'var(--code-keyword)',
  fn: 'var(--code-fn)',
  number: 'var(--code-number)',
  type: 'var(--code-type)'
}

export function tokenizeLine(line: string): { text: string; kind: CodeKind }[] {
  if (!line) return [{ text: ' ', kind: 'text' }]
  if (line.includes('ivec:begin') || line.includes('ivec:end') || line.trimStart().startsWith('//')) {
    return [{ text: line, kind: 'comment' }]
  }

  const chunks = line.split(TOKEN)
  const tokens: { text: string; kind: CodeKind }[] = []
  for (let index = 0; index < chunks.length; index += 1) {
    const part = chunks[index]
    if (!part) continue
    if (part.startsWith('//')) {
      tokens.push({ text: part, kind: 'comment' })
      continue
    }
    if (part.startsWith('"') || part.startsWith("'")) {
      tokens.push({ text: part, kind: 'string' })
      continue
    }
    if (/^0x[0-9a-fA-F]+[uUlL]*$/.test(part) || /^\d+$/.test(part)) {
      tokens.push({ text: part, kind: 'number' })
      continue
    }
    if (/^[A-Za-z_]\w*$/.test(part)) {
      if (KEYWORDS.has(part)) {
        tokens.push({ text: part, kind: 'keyword' })
        continue
      }
      if (TYPES.has(part) || /^[A-Z][A-Z0-9_]+$/.test(part)) {
        tokens.push({ text: part, kind: 'type' })
        continue
      }
      const after = chunks.slice(index + 1).join('')
      const before = chunks.slice(0, index).join('')
      if (/^\s*\(/.test(after) || /\.\s*$/.test(before)) {
        tokens.push({ text: part, kind: 'fn' })
        continue
      }
    }
    tokens.push({ text: part, kind: 'text' })
  }
  return tokens
}

function highlight(line: string) {
  return (
    <>
      {tokenizeLine(line).map((token, index) => {
        const color = token.kind === 'text' ? undefined : COLOR[token.kind]
        return (
          <span key={index} style={color ? { color } : undefined}>
            {token.text}
          </span>
        )
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
