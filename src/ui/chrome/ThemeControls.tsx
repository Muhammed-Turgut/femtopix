import { Moon, Sun, SunMoon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ThemePreference } from '@/shared/api'
import { useAppStore } from '@/store/app-store'
import { IconButton, Tooltip } from '@/ui/primitives'

const THEMES: ThemePreference[] = ['system', 'dark', 'light']

export function ThemeControls() {
  const { t } = useTranslation()
  const themePref = useAppStore((s) => s.themePref)
  const Icon = themePref === 'dark' ? Moon : themePref === 'light' ? Sun : SunMoon

  return (
    <Tooltip content={t(`theme.${themePref}`)}>
      <IconButton aria-label={t(`theme.${themePref}`)} onClick={() => void applyThemeCycle()}>
        <Icon size={16} strokeWidth={1.5} />
      </IconButton>
    </Tooltip>
  )
}

async function applyThemeCycle() {
  const next = THEMES[(THEMES.indexOf(useAppStore.getState().themePref) + 1) % THEMES.length]
  useAppStore.getState().setThemePref(next)
  if (window.ivec) {
    useAppStore.getState().setResolvedTheme(await window.ivec.setTheme(next))
    return
  }
  useAppStore.getState().setResolvedTheme(
    next === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next
  )
}
