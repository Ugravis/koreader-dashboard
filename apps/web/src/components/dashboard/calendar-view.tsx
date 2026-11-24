'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { durationLevel, LEVEL_CLASS } from '@/components/charts/levels'
import { useChartTooltip } from '@/components/charts/tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type ActivityDay, type Book } from '@/lib/api'
import { addDays, authorLine, dayRange, localDay, weekdayIndex } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'
import { BookCover } from './book-cover'

const MAX_COVERS = 3

/** Month view of reading days, with the covers of the books read each day. */
export function CalendarView() {
  const today = useToday()
  return today ? <Calendar today={today} /> : <Skeleton className="h-96 w-full rounded-xl" />
}

function Calendar({ today }: { today: string }) {
  const { t, format, locale } = useI18n()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(today)
  const first = `${month}-01`
  const last = addDays(localDay(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 1)), -1)
  const activity = useLiveQuery(() => api.getActivity(first, last), [first, last])
  const books = useLiveQuery(() => api.listBooks(), [])

  const byDay = new Map(
    activity.status === 'ready' ? activity.data.days.map((d) => [d.date, d]) : [],
  )
  const byId = new Map(books.status === 'ready' ? books.data.books.map((b) => [b.id, b]) : [])
  const cells = [...Array<null>(weekdayIndex(first)).fill(null), ...dayRange(first, last)]
  const loading = activity.status === 'loading'
  const days = [...byDay.values()]
  const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(`${first}T12:00:00`),
  )
  const shift = (n: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + n, 1)
    setMonth(localDay(d).slice(0, 7))
    setSelected(null)
  }
  const selectedDay = selected ? byDay.get(selected) : undefined

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="capitalize">{monthTitle}</CardTitle>
            <CardDescription>
              {loading ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                t.stats.heatmap.summary(
                  format.duration(days.reduce((n, d) => n + d.seconds, 0)),
                  days.length,
                )
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t.calendar.previous}
              onClick={() => shift(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonth(today.slice(0, 7))
                setSelected(today)
              }}
            >
              {t.calendar.today}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t.calendar.next}
              disabled={month >= today.slice(0, 7)}
              onClick={() => shift(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activity.status === 'error' ? (
            <p className="text-sm text-destructive">{t.common.loadError}</p>
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {t.stats.weekdays.map((d) => (
                <span key={d} className="pb-1 text-center text-xs text-muted-foreground">
                  {d}
                </span>
              ))}
              {cells.map((day, i) =>
                day === null ? (
                  <span key={`pad-${i}`} />
                ) : (
                  <DayCell
                    key={day}
                    day={day}
                    activity={byDay.get(day)}
                    books={byId}
                    loading={loading}
                    isToday={day === today}
                    isSelected={day === selected}
                    future={day > today}
                    onSelect={() => setSelected(day)}
                  />
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>{format.day(selected)}</CardTitle>
            <CardDescription>
              {selectedDay
                ? t.calendar.dayTotal(format.duration(selectedDay.seconds), selectedDay.pages)
                : t.calendar.noReading}
            </CardDescription>
          </CardHeader>
          {selectedDay && (
            <CardContent>
              <DayBooks day={selectedDay} books={byId} />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}

function DayCell({
  day,
  activity,
  books,
  loading,
  isToday,
  isSelected,
  future,
  onSelect,
}: {
  day: string
  activity: ActivityDay | undefined
  books: Map<string, Book>
  loading: boolean
  isToday: boolean
  isSelected: boolean
  future: boolean
  onSelect: () => void
}) {
  const { t, format } = useI18n()
  const seconds = activity?.seconds ?? 0
  const covers = (activity?.books ?? [])
    .map((b) => books.get(b.id))
    .filter((b): b is Book => !!b)
    .slice(0, MAX_COVERS)
  const { bind, layer } = useChartTooltip()
  const tip = {
    title: format.longDay(day),
    rows: [
      { label: t.charts.time, value: format.duration(seconds) },
      { label: t.charts.pages, value: format.number(activity?.pages ?? 0) },
      // One row per book read that day, with its time.
      ...(activity?.books ?? []).flatMap(({ id, seconds: s }) => {
        const book = books.get(id)
        return book ? [{ label: book.title, value: format.duration(s) }] : []
      }),
    ],
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={future}
      aria-pressed={isSelected}
      {...(future ? {} : bind(day, tip, { focusable: false }))}
      className={cn(
        'flex aspect-square min-w-0 flex-col items-start gap-1 overflow-hidden rounded-md border p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 sm:aspect-auto sm:h-28 sm:p-1.5',
        isSelected ? 'border-foreground' : 'hover:border-foreground/40',
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span
          className={cn(
            'text-xs tabular-nums',
            isToday && 'rounded-full bg-primary px-1.5 text-primary-foreground',
          )}
        >
          {Number(day.slice(8))}
        </span>
        <span
          className={cn('size-2 shrink-0 rounded-full', LEVEL_CLASS[durationLevel(seconds)])}
          aria-hidden
        />
      </span>
      {loading ? (
        <Skeleton className="hidden h-full w-full sm:block" />
      ) : (
        <>
          {covers.length > 0 && (
            <span className="hidden gap-1 sm:flex">
              {covers.map((b) => (
                <BookCover
                  key={b.id}
                  md5={b.md5}
                  title={b.title}
                  authors={b.authors}
                  isbn={b.isbn}
                  coverUrl={b.cover_url}
                  className="w-8 rounded-sm sm:w-8"
                />
              ))}
            </span>
          )}
          {seconds > 0 && (
            <span className="mt-auto hidden text-[0.65rem] text-muted-foreground tabular-nums md:block">
              {format.duration(seconds)}
            </span>
          )}
        </>
      )}
      {layer}
    </button>
  )
}

function DayBooks({ day, books }: { day: ActivityDay; books: Map<string, Book> }) {
  const { format, href } = useI18n()
  return (
    <ul className="flex flex-col divide-y">
      {day.books.map(({ id, seconds }) => {
        const book = books.get(id)
        if (!book) return null
        return (
          <li key={id} className="py-3 first:pt-0 last:pb-0">
            <Link
              href={href(`/dashboard/books/${id}`)}
              className="flex items-center gap-3 rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BookCover
                md5={book.md5}
                title={book.title}
                authors={book.authors}
                isbn={book.isbn}
                coverUrl={book.cover_url}
                className="w-10 sm:w-10"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{book.title}</span>
                <span className="truncate text-xs text-muted-foreground">{authorLine(book)}</span>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {format.duration(seconds)}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
