export function safeProjectStem(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || 'Adsız').slice(0, 80)
}

export function nextAvailableIvecName(existing: Iterable<string>, stem: string): string {
  const used = new Set(
    [...existing].map((item) => item.toLowerCase())
  )
  const base = safeProjectStem(stem)
  let file = `${base}.ivec`
  let index = 2
  while (used.has(file.toLowerCase())) {
    file = `${base}-${index}.ivec`
    index += 1
  }
  return file
}
