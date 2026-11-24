'use client'

import { CalendarClock, PauseCircle } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type Book } from '@/lib/api'
import {
  addDays,
  finishDay,
  isInProgress,
  remainingSeconds,
  secondsByBook,
  stalledBooks,
} from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'
import { BookCover } from './book-cover'

/** Pace window for the finish estimate. */
export const PACE_DAYS = 14
/** A book in progress not opened for this long counts as paused. */
export const STALLED_DAYS = 30
const MAX = 5

function Row({ book, children }: { book: Book; children: ReactNode }) {
  const { href } = useI18n()
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link
        href={href(`/dashboard/books/${book.id}`)}
        className="flex items-center gap-3 rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BookCover
          md5={book.md5}
          title={book.title}
          authors={book.authors}
          isbn={book.isbn}
          coverUrl={book.cover_url}
          className="w-9 sm:w-9"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{book.title}</span>
          <span className="text-xs text-muted-foreground">{children}</span>
        </span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {Math.round(book.progress * 100)}%
        </span>
      </Link>
    </li>
  )
}

/** Overview card: when the books in progress should be finished at the current pace. */
export function FinishForecast() {
  const today = useToday()
  return today ? <Forecast today={today} /> : null
}

function Forecast({ today }: { today: string }) {
  const { t, format } = useI18n()
  const books = useLiveQuery(() => api.listBooks(), [])
  const activity = useLiveQuery(
    () => api.getActivity(addDays(today, -(PACE_DAYS - 1)), today),
    [today],
  )
  if (books.status === 'error' || activity.status === 'error') return null
  const recent = activity.status === 'ready' ? secondsByBook(activity.data.days) : null
  const list =
    books.status === 'ready' && recent
      ? books.data.books
          .filter((b) => isInProgress(b) && recent.has(b.id))
          .map((b) => ({ book: b, day: finishDay(b, recent.get(b.id) ?? 0, PACE_DAYS, today) }))
          .sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999'))
          .slice(0, MAX)
      : null
  if (list?.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden />
          {t.forecast.title}
        </CardTitle>
        <CardDescription>{t.forecast.description(PACE_DAYS)}</CardDescription>
      </CardHeader>
      <CardContent>
        {list ? (
          <ul className="flex flex-col divide-y">
            {list.map(({ book, day }) => {
              const left = remainingSeconds(book)
              return (
                <Row key={book.id} book={book}>
                  {day ? t.forecast.finishOn(format.day(day)) : t.forecast.unknown}
                  {left !== null && ` · ${t.forecast.left(format.duration(left))}`}
                </Row>
              )
            })}
          </ul>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </CardContent>
    </Card>
  )
}

/** Overview card: books in progress left aside for a while. */
export function PausedBooks() {
  const { t, format } = useI18n()
  const books = useLiveQuery(() => api.listBooks(), [])
  const today = useToday()
  if (books.status !== 'ready' || !today) return null
  const now = Date.parse(`${today}T12:00:00`)
  const list = stalledBooks(books.data.books, STALLED_DAYS, now).slice(0, MAX)
  if (list.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PauseCircle className="size-4" aria-hidden />
          {t.forecast.pausedTitle}
        </CardTitle>
        <CardDescription>{t.forecast.pausedDescription(STALLED_DAYS)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {list.map((book) => (
            <Row key={book.id} book={book}>
              {t.forecast.lastOpened(format.relative(book.last_read_at!))}
            </Row>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
