'use client'

import { CalendarCheck, CalendarDays, Clock, Flame, Timer, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type Book, type DayStat, type ReadingStats } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { useLiveQuery } from '@/lib/use-live-query'
import { BarChart } from './bar-chart'
import { STAT_GRID, StatTile } from './stat-tile'

const sum = (days: DayStat[]) => days.reduce((n, d) => n + d.seconds, 0)

export function StatsView() {
  const { t } = useI18n()
  const stats = useLiveQuery(() => api.getStats(30), [])
  const books = useLiveQuery(() => api.listBooks(), [])

  if (stats.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.common.loadError}
      </p>
    )
  }
  const s = stats.status === 'ready' ? stats.data : null
  if (s && s.reading_days === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.stats.empty}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <KeyFigures stats={s} />
      <Card>
        <CardHeader>
          <CardTitle>{t.stats.last30Days}</CardTitle>
        </CardHeader>
        <CardContent>{s ? <DailyChart days={s.days} /> : <ChartSkeleton />}</CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.stats.byHour}</CardTitle>
          </CardHeader>
          <CardContent>{s ? <HourChart hours={s.by_hour} /> : <ChartSkeleton />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.stats.byWeekday}</CardTitle>
          </CardHeader>
          <CardContent>{s ? <WeekdayChart days={s.by_weekday} /> : <ChartSkeleton />}</CardContent>
        </Card>
      </div>
      <TopBooks books={books.status === 'ready' ? books.data.books : null} />
    </div>
  )
}

function KeyFigures({ stats: s }: { stats: ReadingStats | null }) {
  const { t, format } = useI18n()
  const days = (n: number) => t.stats.days(n)
  const tiles = [
    { label: t.stats.today, icon: Clock, value: s && format.duration(s.days.at(-1)?.seconds ?? 0) },
    {
      label: t.stats.thisWeek,
      icon: CalendarDays,
      value: s && format.duration(sum(s.days.slice(-7))),
    },
    {
      label: t.stats.dailyAverage,
      icon: Timer,
      value: s && format.duration(Math.round(sum(s.days) / s.days.length)),
      hint: t.stats.last30Short,
    },
    {
      label: t.stats.readingDays,
      icon: CalendarCheck,
      value: s && format.number(s.reading_days),
      hint: s?.first_read_on ? t.stats.since(format.day(s.first_read_on)) : undefined,
    },
    { label: t.stats.currentStreak, icon: Flame, value: s && days(s.current_streak) },
    { label: t.stats.longestStreak, icon: Trophy, value: s && days(s.longest_streak) },
  ]
  return (
    <div className={`${STAT_GRID} xl:grid-cols-6`}>
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </div>
  )
}

/** Last days as bars, labelled with the day of the month. */
export function DailyChart({ days, tickEvery = 5 }: { days: DayStat[]; tickEvery?: number }) {
  const { t, format, locale } = useI18n()
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const short = days.length <= 7
  return (
    <BarChart
      highlightLast
      tickEvery={short ? 1 : tickEvery}
      bars={days.map((d) => {
        const date = new Date(`${d.date}T12:00:00`)
        return {
          key: d.date,
          value: d.seconds,
          label: short ? weekday.format(date) : String(date.getDate()),
          tooltip: t.stats.dayTooltip(format.day(d.date), format.duration(d.seconds)),
        }
      })}
    />
  )
}

function HourChart({ hours }: { hours: number[] }) {
  const { t, format } = useI18n()
  return (
    <BarChart
      tickEvery={6}
      bars={hours.map((seconds, h) => ({
        key: String(h),
        value: seconds,
        label: `${h}h`,
        tooltip: t.stats.dayTooltip(`${h}h–${h + 1}h`, format.duration(seconds)),
      }))}
    />
  )
}

function WeekdayChart({ days }: { days: number[] }) {
  const { t, format } = useI18n()
  return (
    <BarChart
      bars={days.map((seconds, i) => ({
        key: String(i),
        value: seconds,
        label: t.stats.weekdays[i] ?? '',
        tooltip: t.stats.dayTooltip(t.stats.weekdays[i] ?? '', format.duration(seconds)),
      }))}
    />
  )
}

export function TopBooks({ books }: { books: Book[] | null }) {
  const { t, format, href } = useI18n()
  const top = books
    ?.filter((b) => b.total_read_seconds > 0)
    .sort((a, b) => b.total_read_seconds - a.total_read_seconds)
    .slice(0, 5)
  if (top?.length === 0) return null
  const max = top?.[0]?.total_read_seconds ?? 1
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.stats.topBooks}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {top
            ? top.map((book) => (
                <li key={book.id}>
                  <Link
                    href={href(`/dashboard/books/${book.id}`)}
                    className="flex flex-col gap-1 rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium">
                        {book.title}
                        <span className="font-normal text-muted-foreground">
                          {cleanMeta(book.authors) &&
                            ` · ${cleanMeta(book.authors)?.split('\n').join(', ')}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {format.duration(book.total_read_seconds)}
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(book.total_read_seconds / max) * 100}%` }}
                      />
                    </span>
                  </Link>
                </li>
              ))
            : [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </ol>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return <Skeleton className="h-44 w-full" />
}

/** Overview card: the last 7 days, linking to the statistics page. */
export function WeekActivity() {
  const { t, format, href } = useI18n()
  const state = useLiveQuery(() => api.getStats(7), [])
  if (state.status === 'error') return null
  const days = state.status === 'ready' ? state.data.days : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.overview.last7Days}</CardTitle>
        <CardDescription>
          {days ? format.duration(sum(days)) : <Skeleton className="h-4 w-20" />}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {days ? <DailyChart days={days} /> : <ChartSkeleton />}
        <Link
          href={href('/dashboard/stats')}
          className="self-end text-sm text-muted-foreground hover:text-foreground"
        >
          {t.overview.seeStats}
        </Link>
      </CardContent>
    </Card>
  )
}

/** Overview card: most read books, own fetch. */
export function TopBooksCard() {
  const state = useLiveQuery(() => api.listBooks(), [])
  if (state.status === 'error') return null
  return <TopBooks books={state.status === 'ready' ? state.data.books : null} />
}
