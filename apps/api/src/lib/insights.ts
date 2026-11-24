import { type Db, schema, sql } from '@koreader-dashboard/db'
import type { BookGroup } from './books.ts'
import { addDays, dayIn, loadSessions, type SessionSummary, summarizeSessions } from './stats.ts'

const { annotations, pageStats } = schema

export type ActivityDay = {
  date: string
  seconds: number
  pages: number
  /** Books read that day (group ids, as in /v1/me/books), most read first. */
  books: { id: string; seconds: number }[]
}

/** Maps every merged KOReader entry to the id of its book group. */
const groupIds = (groups: BookGroup[]) =>
  new Map(groups.flatMap((g) => g.ids.map((id) => [id, g.id] as const)))

/** Days with reading between `from` and `to` (inclusive, `YYYY-MM-DD` in `tz`). */
export async function loadActivity(
  db: Db,
  userId: string,
  groups: BookGroup[],
  tz: string,
  from: string,
  to: string,
): Promise<ActivityDay[]> {
  const local = sql`(${pageStats.startTime} AT TIME ZONE ${tz})`
  const res = await db.execute<{ day: string; book_id: string; seconds: number; pages: number }>(
    sql`
      SELECT to_char(${local}::date, 'YYYY-MM-DD') AS day, ${pageStats.bookId} AS book_id,
        sum(${pageStats.duration})::int AS seconds, count(DISTINCT ${pageStats.page})::int AS pages
      FROM ${pageStats}
      WHERE ${pageStats.userId} = ${userId}
        AND ${local}::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1, 2 ORDER BY 1
    `,
  )
  const toGroup = groupIds(groups)
  const days = new Map<string, ActivityDay>()
  for (const r of res.rows) {
    const day = days.get(r.day) ?? { date: r.day, seconds: 0, pages: 0, books: [] }
    const id = toGroup.get(r.book_id) ?? r.book_id
    const book = day.books.find((b) => b.id === id)
    if (book) book.seconds += r.seconds
    else day.books.push({ id, seconds: r.seconds })
    day.seconds += r.seconds
    day.pages += r.pages
    days.set(r.day, day)
  }
  for (const day of days.values()) day.books.sort((a, b) => b.seconds - a.seconds)
  return [...days.values()]
}

export type BookStats = {
  timezone: string
  /** Reading days, oldest first; `progress` is the furthest point reached so far (0-1). */
  days: { date: string; seconds: number; pages: number; progress: number }[]
  /** Seconds per hour of the day, 0-23. */
  by_hour: number[]
  sessions: SessionSummary
  /** Latest sessions, newest first. */
  recent_sessions: { start: string; seconds: number; pages: number }[]
  first_read_at: string | null
  last_read_at: string | null
  pages_per_hour: number | null
  /** Seconds read on this book over the last 14 days, for the finish estimate. */
  last_14_days_seconds: number
}

export async function loadBookStats(
  db: Db,
  userId: string,
  book: BookGroup,
  tz: string,
  now = new Date(),
): Promise<BookStats> {
  const local = sql`(${pageStats.startTime} AT TIME ZONE ${tz})`
  const ids = sql.join(
    book.ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )
  const where = sql`${pageStats.userId} = ${userId} AND ${pageStats.bookId} IN (${ids})`
  const [daily, hourly, sessions] = await Promise.all([
    db.execute<{ day: string; seconds: number; pages: number; furthest: number | null }>(sql`
      SELECT to_char(${local}::date, 'YYYY-MM-DD') AS day, sum(${pageStats.duration})::int AS seconds,
        count(DISTINCT ${pageStats.page})::int AS pages,
        max(${pageStats.page}::float / nullif(${pageStats.totalPages}, 0)) AS furthest
      FROM ${pageStats} WHERE ${where} GROUP BY 1 ORDER BY 1
    `),
    db.execute<{ slot: number; seconds: number }>(sql`
      SELECT extract(hour FROM ${local})::int AS slot, sum(${pageStats.duration})::int AS seconds
      FROM ${pageStats} WHERE ${where} GROUP BY 1
    `),
    loadSessions(db, where),
  ])

  let furthest = 0
  const days = daily.rows.map((r) => {
    furthest = Math.min(1, Math.max(furthest, r.furthest ?? 0))
    return { date: r.day, seconds: r.seconds, pages: r.pages, progress: furthest }
  })
  const byHour = Array<number>(24).fill(0)
  for (const r of hourly.rows) byHour[r.slot] = r.seconds
  const since = addDays(dayIn(now, tz), -13)
  const last = sessions.at(-1)

  return {
    timezone: tz,
    days,
    by_hour: byHour,
    sessions: summarizeSessions(sessions, tz),
    recent_sessions: sessions.slice(-20).reverse(),
    first_read_at: sessions[0]?.start ?? null,
    last_read_at: last
      ? new Date(Date.parse(last.start) + last.seconds * 1000).toISOString()
      : null,
    pages_per_hour:
      book.total_read_seconds > 0
        ? Math.round((book.pages_read / book.total_read_seconds) * 3600 * 10) / 10
        : null,
    last_14_days_seconds: days.filter((d) => d.date >= since).reduce((n, d) => n + d.seconds, 0),
  }
}

export type AnnotationEntry = {
  id: string
  book_id: string
  book_title: string
  book_authors: string | null
  text: string | null
  note: string | null
  chapter: string | null
  pageno: number | null
  datetime: string | null
  color: string | null
}

/** Every highlight and note, newest first, tied to its book group. */
export async function loadAnnotations(
  db: Db,
  userId: string,
  groups: BookGroup[],
): Promise<AnnotationEntry[]> {
  const res = await db.execute<Omit<AnnotationEntry, 'book_title' | 'book_authors'>>(sql`
    SELECT id, book_id, text, note, chapter, pageno, datetime::text AS datetime, color
    FROM ${annotations}
    WHERE user_id = ${userId} AND (coalesce(text, '') <> '' OR coalesce(note, '') <> '')
    ORDER BY datetime DESC NULLS LAST, pageno
  `)
  const byMember = new Map(groups.flatMap((g) => g.ids.map((id) => [id, g] as const)))
  return res.rows.flatMap((r) => {
    const group = byMember.get(r.book_id)
    if (!group) return []
    return [{ ...r, book_id: group.id, book_title: group.title, book_authors: group.authors }]
  })
}
