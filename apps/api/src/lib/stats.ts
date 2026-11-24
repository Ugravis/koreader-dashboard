import { type SQL, schema, sql } from '@koreader-dashboard/db'
import type { db as Db } from '../db.ts'

const { books, pageStats } = schema

export type DayStat = { date: string; seconds: number; pages: number }
export type MonthStat = { month: string; seconds: number; pages: number }
export type SessionSummary = {
  count: number
  average_seconds: number
  longest_seconds: number
  longest_on: string | null
}
export type Records = {
  best_day: { date: string; seconds: number } | null
  best_month: { month: string; seconds: number } | null
  /** Finished book read over the fewest calendar days. */
  fastest_book: { id: string; title: string; days: number } | null
}

export type ReadingStats = {
  timezone: string
  /** Last `days` calendar days in `timezone`, oldest first, zeros included. */
  days: DayStat[]
  /** Seconds read per hour of the day (0-23), all time. */
  by_hour: number[]
  /** Seconds read per weekday, Monday first, all time. */
  by_weekday: number[]
  /** Seconds per weekday (Monday first) and hour (0-23), all time. */
  by_weekday_hour: number[][]
  /** Every month with reading, oldest first. */
  by_month: MonthStat[]
  sessions: SessionSummary
  records: Records
  reading_days: number
  current_streak: number
  longest_streak: number
  first_read_on: string | null
}

/** Falls back to UTC for an unknown IANA time zone. */
export function safeTimeZone(tz: string | undefined) {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/** `YYYY-MM-DD` of `date` in `tz`. */
export const dayIn = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' }).format(date)

const DAY_MS = 86_400_000
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

/** Longest run of consecutive days, and the run ending today or yesterday. */
export function streaks(sortedDays: string[], today: string) {
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const day of sortedDays) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = day
  }
  const current = prev === today || prev === addDays(today, -1) ? run : 0
  return { current, longest }
}

/** A pause longer than this between two pages starts a new session. */
export const SESSION_GAP_SECONDS = 300

/**
 * Reading sessions of the page stats matching `where`: consecutive pages with less than
 * SESSION_GAP_SECONDS between the end of one and the start of the next.
 */
export async function loadSessions(db: typeof Db, where: SQL) {
  const res = await db.execute<{ start: string; seconds: number; pages: number }>(sql`
    WITH p AS (
      SELECT ${pageStats.bookId} AS book_id, ${pageStats.page} AS page,
        ${pageStats.startTime} AS start_time, ${pageStats.duration} AS duration,
        extract(epoch FROM ${pageStats.startTime} - lag(${pageStats.startTime})
          OVER (ORDER BY ${pageStats.startTime})) - lag(${pageStats.duration})
          OVER (ORDER BY ${pageStats.startTime}) AS gap
      FROM ${pageStats} WHERE ${where}
    ), s AS (
      SELECT *, sum(CASE WHEN gap IS NULL OR gap > ${SESSION_GAP_SECONDS} THEN 1 ELSE 0 END)
        OVER (ORDER BY start_time) AS sid
      FROM p
    )
    SELECT min(start_time) AS start, sum(duration)::int AS seconds,
      count(DISTINCT (book_id, page))::int AS pages
    FROM s GROUP BY sid ORDER BY 1
  `)
  return res.rows.map((r) => ({ ...r, start: new Date(r.start).toISOString() }))
}

export function summarizeSessions(
  sessions: { start: string; seconds: number }[],
  tz: string,
): SessionSummary {
  if (sessions.length === 0)
    return { count: 0, average_seconds: 0, longest_seconds: 0, longest_on: null }
  const longest = sessions.reduce((a, b) => (b.seconds > a.seconds ? b : a))
  const total = sessions.reduce((n, x) => n + x.seconds, 0)
  return {
    count: sessions.length,
    average_seconds: Math.round(total / sessions.length),
    longest_seconds: longest.seconds,
    longest_on: dayIn(new Date(longest.start), tz),
  }
}

export async function loadReadingStats(
  db: typeof Db,
  userId: string,
  tz: string,
  dayCount: number,
  now = new Date(),
): Promise<ReadingStats> {
  const local = sql`(${pageStats.startTime} AT TIME ZONE ${tz})`
  const [daily, hourly, weekly, grid, monthly, sessions, fastest] = await Promise.all([
    db.execute<{ day: string; seconds: number; pages: number }>(sql`
      SELECT to_char(${local}::date, 'YYYY-MM-DD') AS day,
        sum(${pageStats.duration})::int AS seconds,
        count(DISTINCT (${pageStats.bookId}, ${pageStats.page}))::int AS pages
      FROM ${pageStats} WHERE ${pageStats.userId} = ${userId}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute<{ slot: number; seconds: number }>(sql`
      SELECT extract(hour FROM ${local})::int AS slot, sum(${pageStats.duration})::int AS seconds
      FROM ${pageStats} WHERE ${pageStats.userId} = ${userId} GROUP BY 1
    `),
    db.execute<{ slot: number; seconds: number }>(sql`
      SELECT (extract(isodow FROM ${local})::int - 1) AS slot,
        sum(${pageStats.duration})::int AS seconds
      FROM ${pageStats} WHERE ${pageStats.userId} = ${userId} GROUP BY 1
    `),
    db.execute<{ day: number; hour: number; seconds: number }>(sql`
      SELECT (extract(isodow FROM ${local})::int - 1) AS day, extract(hour FROM ${local})::int AS hour,
        sum(${pageStats.duration})::int AS seconds
      FROM ${pageStats} WHERE ${pageStats.userId} = ${userId} GROUP BY 1, 2
    `),
    db.execute<MonthStat>(sql`
      SELECT to_char(${local}, 'YYYY-MM') AS month, sum(${pageStats.duration})::int AS seconds,
        count(DISTINCT (${pageStats.bookId}, ${pageStats.page}))::int AS pages
      FROM ${pageStats} WHERE ${pageStats.userId} = ${userId}
      GROUP BY 1 ORDER BY 1
    `),
    loadSessions(db, sql`${pageStats.userId} = ${userId}`),
    // Same grouping as groupBooks: title + authors, case and spaces ignored.
    db.execute<{ id: string; title: string; days: number }>(sql`
      SELECT (array_agg(b.id))[1] AS id, min(b.title) AS title,
        ((max(${local})::date - min(${local})::date) + 1)::int AS days
      FROM ${pageStats} JOIN ${books} b ON b.id = ${pageStats.bookId}
      WHERE ${pageStats.userId} = ${userId}
      GROUP BY lower(trim(b.title)), lower(trim(coalesce(b.authors, '')))
      HAVING bool_or(b.status = 'complete')
      ORDER BY 3, 2 LIMIT 1
    `),
  ])

  const today = dayIn(now, tz)
  const byDay = new Map(daily.rows.map((r) => [r.day, r]))
  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = addDays(today, i - dayCount + 1)
    const row = byDay.get(date)
    return { date, seconds: row?.seconds ?? 0, pages: row?.pages ?? 0 }
  })
  const fill = (rows: { slot: number; seconds: number }[], size: number) => {
    const out = Array<number>(size).fill(0)
    for (const r of rows) out[r.slot] = r.seconds
    return out
  }
  const readDays = daily.rows.filter((r) => r.seconds > 0).map((r) => r.day)
  const { current, longest } = streaks(readDays, today)

  const byWeekdayHour = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const r of grid.rows) byWeekdayHour[r.day]![r.hour] = r.seconds
  const best = <T extends { seconds: number }>(rows: T[]) =>
    rows.reduce<T | null>((a, b) => (b.seconds > (a?.seconds ?? 0) ? b : a), null)
  const bestDay = best(daily.rows)
  const bestMonth = best(monthly.rows)

  return {
    timezone: tz,
    days,
    by_hour: fill(hourly.rows, 24),
    by_weekday: fill(weekly.rows, 7),
    by_weekday_hour: byWeekdayHour,
    by_month: monthly.rows,
    sessions: summarizeSessions(sessions, tz),
    records: {
      best_day: bestDay && { date: bestDay.day, seconds: bestDay.seconds },
      best_month: bestMonth && { month: bestMonth.month, seconds: bestMonth.seconds },
      fastest_book: fastest.rows[0] ?? null,
    },
    reading_days: readDays.length,
    current_streak: current,
    longest_streak: longest,
    first_read_on: readDays[0] ?? null,
  }
}
