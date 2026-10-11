const MIN_CELL_SCREEN_PX = 10

export function gridStep(zoom: number, minScreenPx = MIN_CELL_SCREEN_PX): number {
  const scale = Math.max(1, zoom)
  let step = 1
  while (step * scale < minScreenPx) step *= 2
  return step
}

export function gridCellScreenPx(zoom: number, minScreenPx = MIN_CELL_SCREEN_PX): number {
  return gridStep(zoom, minScreenPx) * Math.max(1, zoom)
}
