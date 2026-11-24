export const locales = ['en', 'fr'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

/** Cookie holding the language picked in the settings (read by the proxy). */
export const LOCALE_COOKIE = 'locale'

export const isLocale = (value: string | undefined): value is Locale =>
  locales.includes(value as Locale)

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français' }

/** Prefixes an app path with the locale: `/dashboard` -> `/fr/dashboard`. Already prefixed: kept. */
export function localizePath(locale: Locale, path: string) {
  if (isLocale(path.split('/')[1])) return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

/** Removes the locale prefix: `/fr/dashboard` -> `/dashboard`. */
export function stripLocale(pathname: string) {
  const [, first, ...rest] = pathname.split('/')
  return isLocale(first) ? `/${rest.join('/')}` : pathname
}
