'use client'

import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Gauge,
  Hourglass,
  ListOrdered,
  Timer,
  TimerReset,
} from 'lucide-react'
import { LineChart } from '@/components/charts/line-chart'
import { RankList } from '@/components/charts/rank-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type Annotation, type Book } from '@/lib/api'
import { finishDay, remainingSeconds } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'
import { PACE_DAYS } from './reading-forecast'
import { STAT_GRID, StatTile } from './stat-tile'
import { HourChart } from './stats-view'

/** Reading stats of one book: figures, progress over time, hours, sessions, chapters. */
export function BookStats({ book, annotations }: { book: Book; annotations: Annotation[] }) {
  const { t: i18n, format } = useI18n()
  const t = i18n.book
  const state = useLiveQuery(() => api.getBookStats(book.id), [book.id])
  const today = useToday()
  if (state.status === 'error') return null
  const s = state.status === 'ready' ? state.data : null
  if (s && s.days.length === 0) return null

  const left = remainingSeconds(book)
  const finish = s && today && finishDay(book, s.last_14_days_seconds, PACE_DAYS, today)
  const tiles = [
    {
      label: t.firstRead,
      icon: CalendarPlus,
      value: s && (s.first_read_at ? format.day(s.first_read_at.slice(0, 10)) : '—'),
    },
    { label: t.readingDays, icon: CalendarCheck, value: s && format.number(s.days.length) },
    { label: t.sessions, icon: ListOrdered, value: s && format.number(s.sessions.count) },
    {
      label: t.averageSession,
      icon: Timer,
      value: s && format.duration(s.sessions.average_seconds),
      hint: s ? t.longest(format.duration(s.sessions.longest_seconds)) : undefined,
    },
    {
      label: t.speed,
      icon: Gauge,
      value:
        s &&
        (s.pages_per_hour ? i18n.stats.speed.pagesPerHour(format.number(s.pages_per_hour)) : '—'),
    },
    {
      label: t.perDay,
      icon: TimerReset,
      value: s && format.duration(Math.round(book.total_read_seconds / Math.max(1, s.days.length))),
    },
    ...(book.status !== 'complete'
      ? [
          {
            label: t.remaining,
            icon: Hourglass,
            value: s && (left !== null ? format.duration(left) : '—'),
          },
          {
            label: t.estimatedFinish,
            icon: CalendarClock,
            value: s && (finish ? format.day(finish) : '—'),
            hint: finish ? undefined : t.noPace(PACE_DAYS),
          },
        ]
      : []),
  ]

  const chapters = new Map<string, number>()
  for (const a of annotations) {
    if (!a.text) continue
    const c = a.chapter?.trim() || t.noChapter
    chapters.set(c, (chapters.get(c) ?? 0) + 1)
  }
  const topChapters = [...chapters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <>
      <div className={STAT_GRID}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.progressOverTime}</CardTitle>
          </CardHeader>
          <CardContent>
            {s ? (
              <LineChart
                max={1}
                tickEvery={Math.max(1, Math.ceil(s.days.length / 6))}
                points={s.days.map((d) => ({
                  key: d.date,
                  value: d.progress,
                  label: format.day(d.date).replace(/\s?\d{4}$/, ''),
                  tip: {
                    title: format.longDay(d.date),
                    rows: [
                      { label: i18n.charts.progress, value: format.percent(d.progress) },
                      { label: i18n.charts.time, value: format.duration(d.seconds) },
                      { label: i18n.charts.pages, value: format.number(d.pages) },
                    ],
                  },
                }))}
              />
            ) : (
              <Skeleton className="h-44 w-full" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{i18n.stats.byHour}</CardTitle>
          </CardHeader>
          <CardContent>
            {s ? <HourChart hours={s.by_hour} /> : <Skeleton className="h-44 w-full" />}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.recentSessions}</CardTitle>
          </CardHeader>
          <CardContent>
            {s ? (
              <ul className="flex flex-col divide-y text-sm">
                {s.recent_sessions.slice(0, 8).map((x) => (
                  <li
                    key={x.start}
                    className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span>{format.dateTime(x.start)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {format.duration(x.seconds)} · {t.pages(x.pages)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
          </CardContent>
        </Card>
        {topChapters.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t.highlightsByChapter}</CardTitle>
            </CardHeader>
            <CardContent>
              <RankList
                items={topChapters.map(([chapter, n]) => ({
                  key: chapter,
                  label: chapter,
                  value: n,
                  display: format.number(n),
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
