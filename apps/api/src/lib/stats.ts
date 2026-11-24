import { schema, sql } from '@koreader-dashboard/db'
import type { db as Db } from '../db.ts'

const { pageStats } = schema

export type DayStat = { date: string; seconds: number; pages: number }

export type ReadingStats = {
  timezone: string
  /** Last `days` calendar days in `timezone`, oldest first, zeros included. */
  days: DayStat[]
  /** Seconds read per hour of the day (0-23), all time. */
  by_hour: number[]
  /** Seconds read per weekday, Monday first, all time. */
  by_weekday: number[]
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
const dayIn = (date: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' }).format(date)

const DAY_MS = 86_400_000
const addDays = (day: string, n: number) =>
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

export async function loadReadingStats(
  db: typeof Db,
  userId: string,
  tz: string,
  dayCount: number,
  now = new Date(),
): Promise<ReadingStats> {
  const local = sql`(${pageStats.startTime} AT TIME ZONE ${tz})`
  const [daily, hourly, weekly] = await Promise.all([
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

  return {
    timezone: tz,
    days,
    by_hour: fill(hourly.rows, 24),
    by_weekday: fill(weekly.rows, 7),
    reading_days: readDays.length,
    current_streak: current,
    longest_streak: longest,
    first_read_on: readDays[0] ?? null,
  }
}
