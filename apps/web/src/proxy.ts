import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, LOCALE_COOKIE, locales, type Locale } from '@/i18n/config'

/** Cookie (picked in the settings), then the browser languages, then English. */
function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value
  if (isLocale(saved)) return saved
  const accepted = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=')
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  return accepted.map((a) => a.lang).find(isLocale) ?? defaultLocale
}

/** Every page lives under `/[lang]`: unprefixed paths (e.g. the plugin's `/link?code=`) redirect. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const first = pathname.split('/')[1]
  if (locales.some((l) => l === first)) return
  const url = request.nextUrl.clone()
  url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  // Skip Next internals and files (favicon.ico, images...).
  matcher: ['/((?!_next|.*\\..*).*)'],
}
