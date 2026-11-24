'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import { useTheme, type Theme } from '@/lib/theme'

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }
const ICON = { light: Sun, dark: Moon, system: Monitor }

/** Cycles light, dark, system. The settings page offers the full choice. */
export function ThemeToggle() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  const Icon = ICON[theme]
  const label = `${t.settings.appearance.title}: ${t.settings.appearance[theme]}`
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={label}
      title={label}
    >
      <Icon />
    </Button>
  )
}
