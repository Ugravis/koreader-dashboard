'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { localizePath, type Locale } from './config'
import { dictionaries } from './dictionaries'
import { createFormatters } from './format'

const LocaleContext = createContext<Locale | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

/** Dictionary, formatters and a path helper for the current locale. */
export function useI18n() {
  const locale = useContext(LocaleContext)
  if (!locale) throw new Error('useI18n must be used inside I18nProvider')
  return useMemo(
    () => ({
      locale,
      t: dictionaries[locale],
      format: createFormatters(locale),
      href: (path: string) => localizePath(locale, path),
    }),
    [locale],
  )
}
