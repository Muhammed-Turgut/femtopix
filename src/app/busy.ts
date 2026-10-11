const MIN_BUSY_MS = 800

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function waitPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  })
}

export async function holdBusy(startedAt: number): Promise<void> {
  await waitPaint()
  const left = MIN_BUSY_MS - (Date.now() - startedAt)
  if (left > 0) await waitMs(left)
}
