'use client'

import { BookCheck, CalendarCheck, Clock, FileText, Flame, Printer, Sun } from 'lucide-react'
import { useState } from 'react'
import { RankList } from '@/components/charts/rank-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type ActivityDay, type Book } from '@/lib/api'
import { addDays, authorsOf, secondsByBook } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'
import { BarChart } from './bar-chart'
import { BOOK_GRID, BookCard } from './book-card'
import { finishedIn } from './goals'
import { STAT_GRID, StatTile } from './stat-tile'

const TOP = 5

function longestRun(days: ActivityDay[]) {
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of days) {
    run = prev && addDays(prev, 1) === d.date ? run + 1 : 1
    best = Math.max(best, run)
    prev = d.date
  }
  return best
}

/** Weighted ranking: each book's time in the year goes to each of its keys. */
function rank(books: Book[], time: Map<string, number>, keysOf: (b: Book) => string[]) {
  const out = new Map<string, { label: string; seconds: number }>()
  for (const b of books) {
    const s = time.get(b.id) ?? 0
    if (!s) continue
    for (const label of keysOf(b)) {
      const e = out.get(label.toLowerCase()) ?? { label, seconds: 0 }
      e.seconds += s
      out.set(label.toLowerCase(), e)
    }
  }
  return [...out.entries()].sort((a, b) => b[1].seconds - a[1].seconds).slice(0, TOP)
}

export function YearReview() {
  const today = useToday()
  return today ? <Review today={today} /> : <Skeleton className="h-96 w-full rounded-xl" />
}

function Review({ today }: { today: string }) {
  const { t, format, locale, href } = useI18n()
  const thisYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const to = year === thisYear ? today : `${year}-12-31`
  const activity = useLiveQuery(() => api.getActivity(`${year}-01-01`, to), [year, to])
  const booksState = useLiveQuery(() => api.listBooks(), [])
  const days = activity.status === 'ready' ? activity.data.days : null
  const books = booksState.status === 'ready' ? booksState.data.books : null
  const ready = days && books
  const time = days ? secondsByBook(days) : new Map<string, number>()
  const finished = books ? finishedIn(books, year) : []
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthLong = new Intl.DateTimeFormat(locale, { month: 'long' })
  const months = Array.from({ length: 12 }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const inMonth = (days ?? []).filter((d) => d.date.startsWith(key))
    return {
      key,
      seconds: inMonth.reduce((n, d) => n + d.seconds, 0),
      pages: inMonth.reduce((n, d) => n + d.pages, 0),
      days: inMonth.length,
      label: monthName.format(new Date(year, m, 15)),
      long: monthLong.format(new Date(year, m, 15)),
    }
  })
  const bestMonth = months.reduce((a, b) => (b.seconds > a.seconds ? b : a))
  const totalSeconds = (days ?? []).reduce((n, d) => n + d.seconds, 0)

  const tiles = [
    { label: t.overview.totalTime, icon: Clock, value: ready && format.duration(totalSeconds) },
    { label: t.review.finished, icon: BookCheck, value: ready && format.number(finished.length) },
    {
      label: t.overview.pagesRead,
      icon: FileText,
      value: ready && format.number((days ?? []).reduce((n, d) => n + d.pages, 0)),
    },
    { label: t.stats.readingDays, icon: CalendarCheck, value: ready && format.number(days.length) },
    { label: t.stats.longestStreak, icon: Flame, value: ready && t.stats.days(longestRun(days)) },
    {
      label: t.stats.records.bestMonth,
      icon: Sun,
      value: ready && (bestMonth.seconds ? bestMonth.label : '—'),
      hint: bestMonth.seconds ? format.duration(bestMonth.seconds) : undefined,
    },
  ].map((tile) => ({ ...tile, value: tile.value || null }))

  const topBooks = books
    ?.filter((b) => time.get(b.id))
    .sort((a, b) => (time.get(b.id) ?? 0) - (time.get(a.id) ?? 0))
    .slice(0, TOP)
  const asItems = (list: [string, { label: string; seconds: number }][]) =>
    list.map(([key, v]) => ({
      key,
      label: v.label,
      value: v.seconds,
      display: format.duration(v.seconds),
    }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-1" role="group" aria-label={t.stats.heatmap.year}>
          {[0, 1, 2, 3].map((i) => (
            <Button
              key={i}
              size="sm"
              variant={thisYear - i === year ? 'default' : 'ghost'}
              aria-pressed={thisYear - i === year}
              onClick={() => setYear(thisYear - i)}
            >
              {thisYear - i}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          {t.review.print}
        </Button>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight">{t.review.heading(year)}</h2>
      {activity.status === 'error' || booksState.status === 'error' ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : ready && days.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t.review.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={`${STAT_GRID} xl:grid-cols-6`}>
            {tiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t.review.byMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              {ready ? (
                <BarChart
                  bars={months.map((m) => ({
                    key: m.key,
                    value: m.seconds,
                    label: m.label,
                    tip: {
                      title: `${m.long} ${year}`,
                      rows: [
                        { label: t.charts.time, value: format.duration(m.seconds) },
                        { label: t.charts.readingDays, value: format.number(m.days) },
                        { label: t.charts.pages, value: format.number(m.pages) },
                      ],
                    },
                  }))}
                />
              ) : (
                <Skeleton className="h-44 w-full" />
              )}
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t.stats.topBooks}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankList
                  items={
                    ready
                      ? (topBooks ?? []).map((b) => ({
                          key: b.id,
                          label: b.title,
                          value: time.get(b.id) ?? 0,
                          display: format.duration(time.get(b.id) ?? 0),
                          href: href(`/dashboard/books/${b.id}`),
                        }))
                      : null
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t.review.topAuthors}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankList items={ready ? asItems(rank(books, time, authorsOf)) : null} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t.review.topGenres}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankList items={ready ? asItems(rank(books, time, (b) => b.keywords)) : null} />
              </CardContent>
            </Card>
          </div>
          {finished.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.review.finishedBooks}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className={BOOK_GRID}>
                  {finished.map((b) => (
                    <BookCard key={b.id} book={b} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
