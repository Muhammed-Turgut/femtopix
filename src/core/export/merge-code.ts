interface Hunk {
  start: number
  end: number
  lines: string[]
  side: 0 | 1
}

function matches(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i += 1
    else j += 1
  }
  return pairs
}

function hunks(base: string[], other: string[], side: 0 | 1): Hunk[] {
  const pairs = [...matches(base, other), [base.length, other.length] as [number, number]]
  const out: Hunk[] = []
  let bi = 0
  let oi = 0
  for (const [b, o] of pairs) {
    if (b > bi || o > oi) out.push({ start: bi, end: b, lines: other.slice(oi, o), side })
    bi = b + 1
    oi = o + 1
  }
  return out
}

function applySide(base: string[], group: Hunk[], side: 0 | 1, start: number, end: number): string[] {
  const out: string[] = []
  let pos = start
  for (const hunk of group) {
    if (hunk.side !== side) continue
    out.push(...base.slice(pos, hunk.start), ...hunk.lines)
    pos = hunk.end
  }
  out.push(...base.slice(pos, end))
  return out
}

/**
 * Three-way line merge: `ours` is the hand-edited code, `theirs` is freshly generated.
 * Where both touched the same lines differently, the hand-edited lines win and `conflict` is set.
 */
export function mergeCode(base: string, ours: string, theirs: string): { code: string; conflict: boolean } {
  if (ours === base) return { code: theirs, conflict: false }
  if (theirs === base || theirs === ours) return { code: ours, conflict: false }

  const baseLines = base.split('\n')
  const all = [...hunks(baseLines, ours.split('\n'), 0), ...hunks(baseLines, theirs.split('\n'), 1)].sort(
    (x, y) => x.start - y.start || x.end - x.start - (y.end - y.start)
  )

  const result: string[] = []
  let conflict = false
  let pos = 0
  let index = 0
  while (index < all.length) {
    const group = [all[index]!]
    const start = group[0]!.start
    let end = group[0]!.end
    index += 1
    while (index < all.length) {
      const next = all[index]!
      const insertionsTogether = next.start === start && next.start === next.end && start === end
      if (next.start < end || insertionsTogether) {
        group.push(next)
        end = Math.max(end, next.end)
        index += 1
      } else break
    }
    result.push(...baseLines.slice(pos, start))
    const sides = new Set(group.map((hunk) => hunk.side))
    if (sides.size === 1) {
      result.push(...applySide(baseLines, group, group[0]!.side, start, end))
    } else {
      const mine = applySide(baseLines, group, 0, start, end)
      const generated = applySide(baseLines, group, 1, start, end)
      if (mine.join('\n') !== generated.join('\n')) conflict = true
      result.push(...mine)
    }
    pos = end
  }
  result.push(...baseLines.slice(pos))
  return { code: result.join('\n'), conflict }
}
