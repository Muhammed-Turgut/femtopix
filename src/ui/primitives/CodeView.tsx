import { useEffect, useRef, useState } from 'react'

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

export function CodeView({ value, onCommit }: { value: string; onCommit?: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const draftRef = useRef(draft)

  useEffect(() => {
    if (focused) return
    draftRef.current = value
    setDraft(value)
  }, [value, focused])

  if (onCommit) {
    const lines = draft.split('\n')
    const update = (text: string) => {
      draftRef.current = text
      setDraft(text)
    }
    return (
      <div className="scrollbar-thin h-full overflow-auto bg-input font-mono text-[12px] leading-[18px] text-ink">
        <div className="flex min-h-full min-w-max">
          <div className="w-10 shrink-0 select-none pr-3 text-right text-muted tabular-nums">
            {lines.map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 pr-4">
            <div aria-hidden className="pointer-events-none whitespace-pre">
              {lines.map((line, index) => (
                <div key={index}>{highlight(line)}</div>
              ))}
              <div> </div>
            </div>
            <textarea
              className="absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre bg-transparent p-0 font-mono text-[12px] leading-[18px] text-transparent caret-ink outline-none selection:bg-accent/30 selection:text-transparent"
              wrap="off"
              spellCheck={false}
              value={draft}
              onFocus={() => setFocused(true)}
              onChange={(event) => update(event.target.value)}
              onBlur={() => {
                setFocused(false)
                if (draftRef.current !== value) onCommit(draftRef.current)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Tab') return
                event.preventDefault()
                const el = event.currentTarget
                const start = el.selectionStart
                const text = draftRef.current
                update(`${text.slice(0, start)}  ${text.slice(el.selectionEnd)}`)
                requestAnimationFrame(() => {
                  el.selectionStart = start + 2
                  el.selectionEnd = start + 2
                })
              }}
            />
          </div>
        </div>
      </div>
    )
  }

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
