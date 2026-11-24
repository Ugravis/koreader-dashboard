'use client'

import {
  BookCheck,
  CalendarCheck,
  CalendarRange,
  Clock,
  FileText,
  Hourglass,
  ListOrdered,
  Medal,
  Sun,
  Timer,
} from 'lucide-react'
import { useState } from 'react'
import { ContributionGraph } from '@/components/charts/contribution-graph'
import { LineChart } from '@/components/charts/line-chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type DayStat, type ReadingStats } from '@/lib/api'
import { addDays, localDay, percentChange } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'
import { STAT_GRID, StatTile } from './stat-tile'

const total = (days: DayStat[], key: 'seconds' | 'pages') => days.reduce((n, d) => n + d[key], 0)

/** This month so far against the same days of last month. */
export function MonthComparison({ stats }: { stats: ReadingStats | null }) {
  const { t, format } = useI18n()
  const day = useToday()
  const s = day ? stats : null
  const today = day ?? '2000-01-01'
  const dayOfMonth = Number(today.slice(8))
  const lastMonthStart = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)
  const before = localDay(lastMonthStart)
  const beforeEnd = addDays(before, dayOfMonth - 1)
  const now = s?.days.filter((d) => d.date.slice(0, 7) === today.slice(0, 7)) ?? []
  const prev =
    s?.days.filter(
      (d) => d.date >= before && d.date <= beforeEnd && d.date.slice(0, 7) === before.slice(0, 7),
    ) ?? []
  const delta = (a: number, b: number) => {
    const pct = percentChange(a, b)
    return pct === null ? t.stats.compare.noBase : t.stats.compare.change(pct)
  }
  const readDays = (days: DayStat[]) => days.filter((d) => d.seconds > 0).length
  const tiles = [
    {
      label: t.stats.compare.time,
      icon: Clock,
      value: s && format.duration(total(now, 'seconds')),
      hint: s ? delta(total(now, 'seconds'), total(prev, 'seconds')) : undefined,
    },
    {
      label: t.stats.compare.pages,
      icon: FileText,
      value: s && format.number(total(now, 'pages')),
      hint: s ? delta(total(now, 'pages'), total(prev, 'pages')) : undefined,
    },
    {
      label: t.stats.compare.days,
      icon: CalendarCheck,
      value: s && format.number(readDays(now)),
      hint: s ? delta(readDays(now), readDays(prev)) : undefined,
    },
  ]
  return (
    <section className="flex flex-col gap-3" aria-labelledby="compare">
      <h2 id="compare" className="text-lg font-semibold tracking-tight">
        {t.stats.compare.title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
    </section>
  )
}

export function SessionsAndRecords({ stats: s }: { stats: ReadingStats | null }) {
  const { t, format, locale } = useI18n()
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const r = s?.records
  const tiles = [
    {
      label: t.stats.sessions.count,
      icon: ListOrdered,
      value: s && format.number(s.sessions.count),
    },
    {
      label: t.stats.sessions.average,
      icon: Timer,
      value: s && format.duration(s.sessions.average_seconds),
    },
    {
      label: t.stats.sessions.longest,
      icon: Hourglass,
      value: s && format.duration(s.sessions.longest_seconds),
      hint: s?.sessions.longest_on ? format.day(s.sessions.longest_on) : undefined,
    },
    {
      label: t.stats.sessions.perDay,
      icon: CalendarRange,
      value: s && (s.reading_days ? (s.sessions.count / s.reading_days).toFixed(1) : '0'),
    },
    {
      label: t.stats.records.bestDay,
      icon: Sun,
      value: s && (r?.best_day ? format.duration(r.best_day.seconds) : '—'),
      hint: r?.best_day ? format.day(r.best_day.date) : undefined,
    },
    {
      label: t.stats.records.bestMonth,
      icon: Medal,
      value: s && (r?.best_month ? format.duration(r.best_month.seconds) : '—'),
      hint: r?.best_month ? month.format(new Date(`${r.best_month.month}-15T12:00:00`)) : undefined,
    },
    {
      label: t.stats.records.fastestBook,
      icon: BookCheck,
      value: s && (r?.fastest_book ? t.stats.days(r.fastest_book.days) : '—'),
      hint: r?.fastest_book?.title,
    },
  ]
  return (
    <section className="flex flex-col gap-3" aria-labelledby="records">
      <h2 id="records" className="text-lg font-semibold tracking-tight">
        {t.stats.records.title}
      </h2>
      <div className={STAT_GRID}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
    </section>
  )
}

/** Pages per hour, month by month (last 12 months with reading). */
export function SpeedChart({ stats: s }: { stats: ReadingStats | null }) {
  const { t, format, locale } = useI18n()
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
  const months = s?.by_month.filter((m) => m.seconds >= 600).slice(-12)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.stats.speed.title}</CardTitle>
        <CardDescription>{t.stats.speed.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!months ? (
          <Skeleton className="h-44 w-full" />
        ) : months.length < 2 ? (
          <p className="text-sm text-muted-foreground">{t.stats.speed.notEnough}</p>
        ) : (
          <LineChart
            tickEvery={months.length > 6 ? 2 : 1}
            points={months.map((m) => {
              const speed = Math.round((m.pages / m.seconds) * 3600 * 10) / 10
              const label = month.format(new Date(`${m.month}-15T12:00:00`))
              return {
                key: m.month,
                value: speed,
                label,
                tip: {
                  title: `${label} ${m.month.slice(0, 4)}`,
                  rows: [
                    {
                      label: t.charts.speed,
                      value: t.stats.speed.pagesPerHour(format.number(speed)),
                    },
                    { label: t.charts.pages, value: format.number(m.pages) },
                    { label: t.charts.time, value: format.duration(m.seconds) },
                  ],
                },
              }
            })}
          />
        )}
      </CardContent>
    </Card>
  )
}

/** GitHub-like year of reading days, with a year switcher. */
export function YearHeatmap({ firstYear }: { firstYear: number | null }) {
  const today = useToday()
  return today ? (
    <YearHeatmapCard firstYear={firstYear} today={today} />
  ) : (
    <Skeleton className="h-52 w-full rounded-xl" />
  )
}

function YearHeatmapCard({ firstYear, today }: { firstYear: number | null; today: string }) {
  const { t, format } = useI18n()
  const thisYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const from = `${year}-01-01`
  const to = year === thisYear ? today : `${year}-12-31`
  const state = useLiveQuery(() => api.getActivity(from, to), [from, to])
  const days = state.status === 'ready' ? state.data.days : null
  const heat = new Map(
    days?.map((d) => [d.date, { seconds: d.seconds, pages: d.pages, books: d.books.length }]),
  )
  const oldest = Math.min(firstYear ?? thisYear, thisYear)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle>{t.stats.heatmap.title}</CardTitle>
          <CardDescription>
            {days
              ? t.stats.heatmap.summary(
                  format.duration(days.reduce((n, d) => n + d.seconds, 0)),
                  days.length,
                )
              : t.common.pleaseWait}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={t.stats.heatmap.year}>
          {Array.from({ length: thisYear - oldest + 1 }, (_, i) => thisYear - i)
            .slice(0, 5)
            .map((y) => (
              <Button
                key={y}
                size="sm"
                variant={y === year ? 'default' : 'ghost'}
                aria-pressed={y === year}
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent>
        {state.status === 'error' ? (
          <p className="text-sm text-destructive">{t.common.loadError}</p>
        ) : days ? (
          <ContributionGraph from={from} to={`${year}-12-31`} days={heat} />
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </CardContent>
    </Card>
  )
}
