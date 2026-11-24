'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { DARK_QUERY, THEME_COOKIE as COOKIE } from './theme-script'

export const themes = ['light', 'dark', 'system'] as const
export type Theme = (typeof themes)[number]

const MAX_AGE = 60 * 60 * 24 * 365

const readTheme = (): Theme => {
  const value = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))?.[1]
  return themes.includes(value as Theme) ? (value as Theme) : 'system'
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Saved theme preference and its setter; follows the OS while on `system`. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme)

  useEffect(() => {
    if (theme !== 'system') return
    const media = matchMedia(DARK_QUERY)
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    document.cookie = `${COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`
    apply(next)
    listeners.forEach((l) => l())
  }, [])

  return { theme, setTheme }
}
