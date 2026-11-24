import type { ActivityDay, Book } from './api'
import { cleanMeta } from './covers'

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` of `date` in the browser time zone. */
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

/** 0 for Monday to 6 for Sunday. */
export const weekdayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

/** Every day from `from` to `to` inclusive. */
export function dayRange(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export const authorsOf = (book: Pick<Book, 'authors'>) =>
  (cleanMeta(book.authors) ?? '')
    .split('\n')
    .map((a) => a.trim())
    .filter(Boolean)

export const authorLine = (book: Pick<Book, 'authors'>) => authorsOf(book).join(', ')

export const isInProgress = (b: Book) =>
  b.status === 'reading' || (b.status === null && b.progress > 0 && b.progress < 1)

/** Reading time still needed at the book's own pace, null before any progress. */
export function remainingSeconds(book: Book) {
  if (book.progress <= 0.01 || book.progress >= 1 || book.total_read_seconds <= 0) return null
  return Math.round((book.total_read_seconds * (1 - book.progress)) / book.progress)
}

/**
 * Estimated finish day: remaining time at the average daily time spent on the book over
 * `windowDays`. Null when the book was not read in that window.
 */
export function finishDay(book: Book, recentSeconds: number, windowDays: number, today: string) {
  const remaining = remainingSeconds(book)
  if (remaining === null || recentSeconds <= 0) return null
  const perDay = recentSeconds / windowDays
  return addDays(today, Math.max(1, Math.ceil(remaining / perDay)))
}

/** Seconds per book over the given activity days. */
export function secondsByBook(days: ActivityDay[]) {
  const out = new Map<string, number>()
  for (const day of days) for (const b of day.books) out.set(b.id, (out.get(b.id) ?? 0) + b.seconds)
  return out
}

/** Books in progress not opened for `days` days, the longest idle first. */
export function stalledBooks(books: Book[], days: number, now = Date.now()) {
  return books
    .filter((b) => (isInProgress(b) || b.status === 'abandoned') && b.last_read_at)
    .filter((b) => now - Date.parse(b.last_read_at!) > days * DAY_MS)
    .sort((a, b) => a.last_read_at!.localeCompare(b.last_read_at!))
}

export type Group = {
  key: string
  label: string
  books: Book[]
  seconds: number
  finished: number
}

/** Groups books by one or several keys each (an author, a genre). */
export function groupBy(books: Book[], keysOf: (b: Book) => string[]): Group[] {
  const groups = new Map<string, Group>()
  for (const book of books) {
    for (const label of keysOf(book)) {
      const key = label.toLowerCase()
      const g = groups.get(key) ?? { key, label, books: [], seconds: 0, finished: 0 }
      g.books.push(book)
      g.seconds += book.total_read_seconds
      if (book.status === 'complete') g.finished += 1
      groups.set(key, g)
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.seconds - a.seconds || b.books.length - a.books.length,
  )
}

export type Saga = Group & {
  /** Highest volume number known, at least the number of books owned. */
  volumes: number
}

export function sagas(books: Book[]): Saga[] {
  return groupBy(books, (b) => {
    const s = cleanMeta(b.series)
    return s ? [s] : []
  }).map((g) => ({
    ...g,
    books: [...g.books].sort((a, b) => (a.series_index ?? 99) - (b.series_index ?? 99)),
    volumes: Math.max(g.books.length, ...g.books.map((b) => Math.floor(b.series_index ?? 0))),
  }))
}

/** Same pick for the whole day: an index from the day string. */
export function dailyIndex(length: number, day = localDay()) {
  let hash = 0
  for (const c of day) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return length > 0 ? hash % length : 0
}

/** Change from `before` to `now` in percent, null without a base. */
export const percentChange = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null

/** Triggers a file download in the browser. */
export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** KOReader descriptions often contain HTML: keep the text only. */
export const plainText = (html: string) =>
  html
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
