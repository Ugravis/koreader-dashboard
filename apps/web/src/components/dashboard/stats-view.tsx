'use client'

import { CalendarCheck, CalendarDays, Clock, Flame, Timer, Trophy } from 'lucide-react'
import Link from 'next/link'
import { HabitGrid } from '@/components/charts/habit-grid'
import { RankList } from '@/components/charts/rank-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type Book, type DayStat, type ReadingStats } from '@/lib/api'
import { authorLine } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { BarChart } from './bar-chart'
import { GenreStats, SagaStats } from './library-insights'
import { MonthComparison, SessionsAndRecords, SpeedChart, YearHeatmap } from './stats-sections'
import { STAT_GRID, StatTile } from './stat-tile'

const sum = (days: DayStat[]) => days.reduce((n, d) => n + d.seconds, 0)

export function StatsView() {
  const { t } = useI18n()
  // Two months: the last 30 days, and this month against the last one.
  const stats = useLiveQuery(() => api.getStats(62), [])
  const books = useLiveQuery(() => api.listBooks(), [])

  if (stats.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.common.loadError}
      </p>
    )
  }
  const s = stats.status === 'ready' ? stats.data : null
  const last30 = s && { ...s, days: s.days.slice(-30) }
  const bookList = books.status === 'ready' ? books.data.books : null
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
      <KeyFigures stats={last30} />
      <YearHeatmap firstYear={s?.first_read_on ? Number(s.first_read_on.slice(0, 4)) : null} />
      <MonthComparison stats={s} />
      <Card>
        <CardHeader>
          <CardTitle>{t.stats.last30Days}</CardTitle>
        </CardHeader>
        <CardContent>{last30 ? <DailyChart days={last30.days} /> : <ChartSkeleton />}</CardContent>
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
      <Card>
        <CardHeader>
          <CardTitle>{t.stats.habits}</CardTitle>
        </CardHeader>
        <CardContent>{s ? <HabitGrid grid={s.by_weekday_hour} /> : <ChartSkeleton />}</CardContent>
      </Card>
      <SessionsAndRecords stats={s} />
      <SpeedChart stats={s} />
      <div className="grid gap-6 lg:grid-cols-2">
        <GenreStats books={bookList} />
        <SagaStats books={bookList} />
      </div>
      <TopBooks books={bookList} />
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
          tip: {
            title: format.longDay(d.date),
            rows: [
              { label: t.charts.time, value: format.duration(d.seconds) },
              { label: t.charts.pages, value: format.number(d.pages) },
            ],
          },
        }
      })}
    />
  )
}

/** Share of `value` in `total`, for tooltips. */
const shareOf = (value: number, total: number) => (total > 0 ? value / total : 0)

export function HourChart({ hours }: { hours: number[] }) {
  const { t, format } = useI18n()
  const total = hours.reduce((a, b) => a + b, 0)
  return (
    <BarChart
      tickEvery={6}
      bars={hours.map((seconds, h) => ({
        key: String(h),
        value: seconds,
        label: `${h}h`,
        tip: {
          title: `${h}h – ${h + 1}h`,
          rows: [
            { label: t.charts.time, value: format.duration(seconds) },
            { label: t.charts.share, value: format.percent(shareOf(seconds, total)) },
          ],
        },
      }))}
    />
  )
}

function WeekdayChart({ days }: { days: number[] }) {
  const { t, format, locale } = useI18n()
  const total = days.reduce((a, b) => a + b, 0)
  // 2024-01-01 is a Monday.
  const name = (i: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, 1 + i))
  return (
    <BarChart
      bars={days.map((seconds, i) => ({
        key: String(i),
        value: seconds,
        label: t.stats.weekdays[i] ?? '',
        tip: {
          title: name(i),
          rows: [
            { label: t.charts.time, value: format.duration(seconds) },
            { label: t.charts.share, value: format.percent(shareOf(seconds, total)) },
          ],
        },
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.stats.topBooks}</CardTitle>
      </CardHeader>
      <CardContent>
        <RankList
          items={
            top?.map((book) => ({
              key: book.id,
              label: book.title,
              detail: authorLine(book) || undefined,
              value: book.total_read_seconds,
              display: format.duration(book.total_read_seconds),
              href: href(`/dashboard/books/${book.id}`),
            })) ?? null
          }
        />
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
