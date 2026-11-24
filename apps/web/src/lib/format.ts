/** 3725 -> "1 h 2 min", 45 -> "0 min". */
export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en').format(n)

export function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago". */
export function formatRelative(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  if (seconds > -60) return 'just now'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })
  const minutes = Math.round(seconds / 60)
  if (minutes > -60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours > -24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}
