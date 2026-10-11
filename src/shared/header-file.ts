export const HEADER_FILE_MAX_BYTES = 512 * 1024

export function headerFileName(name: string): string {
  const stem = name.replace(/\\/g, '/').split('/').pop() ?? 'icon'
  const base = stem.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]+/g, '_') || 'icon'
  return /^[0-9]/.test(base) ? `_${base}.h` : `${base}.h`
}
