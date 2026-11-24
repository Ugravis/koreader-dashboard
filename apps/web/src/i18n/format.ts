import type { Locale } from './config'
import { dictionaries } from './dictionaries'

/** Number, duration and date formatters for a locale. */
export function createFormatters(locale: Locale) {
  const t = dictionaries[locale]
  const number = new Intl.NumberFormat(locale)
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

  return {
    number: (n: number) => number.format(n),
    /** 3725 -> "1 h 2 min", 45 -> "0 min". */
    duration(seconds: number) {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return hours > 0
        ? t.common.hoursMinutes(number.format(hours), minutes)
        : t.common.minutes(minutes)
    },
    dateTime: (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : t.common.never),
    /** `YYYY-MM-DD` (a calendar day, no time zone) -> "24 Nov 2026". */
    day: (day: string) => date.format(new Date(`${day}T12:00:00`)),
    /** "just now", "5 min ago", "3 hours ago", "2 days ago". */
    relative(iso: string, now = Date.now()) {
      const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
      if (seconds > -60) return t.sync.justNow
      const minutes = Math.round(seconds / 60)
      if (minutes > -60) return rtf.format(minutes, 'minute')
      const hours = Math.round(minutes / 60)
      if (hours > -24) return rtf.format(hours, 'hour')
      return rtf.format(Math.round(hours / 24), 'day')
    },
  }
}

export type Formatters = ReturnType<typeof createFormatters>
