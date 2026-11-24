import { type Db, schema, sql } from '@koreader-dashboard/db'

/** One `books` row with its reading aggregates. */
export type BookRow = {
  id: string
  md5: string
  title: string
  authors: string | null
  series: string | null
  series_index: number | null
  language: string | null
  identifiers: string | null
  description: string | null
  pages: number | null
  status: string | null
  status_modified: string | null
  percent_finished: number | null
  rating: number | null
  review: string | null
  library_updated_at: Date | null
  total_read_seconds: string
  pages_read: string
  last_read_at: Date | null
  last_page: number | null
  last_total_pages: number | null
  highlights_count: string
  notes_count: string
}

export type BookGroup = {
  /** Most recently active member: stable entry point for the book page. */
  id: string
  ids: string[]
  md5: string
  title: string
  authors: string | null
  series: string | null
  series_index: number | null
  language: string | null
  isbn: string | null
  description: string | null
  status: 'reading' | 'complete' | 'abandoned' | null
  status_modified: string | null
  rating: number | null
  review: string | null
  progress: number
  total_read_seconds: number
  pages_read: number
  last_read_at: string | null
  highlights_count: number
  notes_count: number
}

const { books, pageStats, annotations } = schema

export async function loadBookRows(db: Db, userId: string) {
  const res = await db.execute<BookRow>(sql`
    SELECT b.id, b.md5, b.title, b.authors, b.series, b.series_index, b.language, b.identifiers,
           b.description, b.pages, b.status, b.status_modified, b.percent_finished, b.rating,
           b.review, b.library_updated_at,
           coalesce(t.seconds, 0) AS total_read_seconds,
           coalesce(t.pages_read, 0) AS pages_read,
           l.start_time AS last_read_at, l.page AS last_page, l.total_pages AS last_total_pages,
           coalesce(a.highlights, 0) AS highlights_count, coalesce(a.notes, 0) AS notes_count
    FROM ${books} b
    LEFT JOIN (
      SELECT book_id, sum(duration) AS seconds, count(DISTINCT page) AS pages_read
      FROM ${pageStats} WHERE user_id = ${userId} GROUP BY book_id
    ) t ON t.book_id = b.id
    LEFT JOIN (
      SELECT DISTINCT ON (book_id) book_id, start_time, page, total_pages FROM ${pageStats}
      WHERE user_id = ${userId} ORDER BY book_id, start_time DESC
    ) l ON l.book_id = b.id
    LEFT JOIN (
      SELECT book_id,
             count(*) FILTER (WHERE coalesce(text, '') <> '') AS highlights,
             count(*) FILTER (WHERE coalesce(note, '') <> '') AS notes
      FROM ${annotations} WHERE user_id = ${userId} GROUP BY book_id
    ) a ON a.book_id = b.id
    WHERE b.user_id = ${userId}
  `)
  return res.rows
}

/** ISBN from KOReader doc_props identifiers ("scheme:value" lines). */
export function parseIsbn(identifiers: string | null) {
  if (!identifiers) return null
  const match =
    /isbn[^0-9]*([0-9][0-9-]{8,16}[0-9xX])/i.exec(identifiers) ??
    /\b(97[89][0-9]{10})\b/.exec(identifiers)
  const isbn = match?.[1]?.replace(/-/g, '')
  return isbn && (isbn.length === 10 || isbn.length === 13) ? isbn : null
}

const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
export const groupKey = (b: { title: string; authors: string | null }) =>
  `${norm(b.title)}\u0000${norm(b.authors)}`

const activity = (b: BookRow) =>
  Math.max(
    b.last_read_at ? new Date(b.last_read_at).getTime() : 0,
    b.status_modified ? new Date(b.status_modified).getTime() : 0,
    b.library_updated_at ? new Date(b.library_updated_at).getTime() : 0,
  )

const STATUSES = ['reading', 'complete', 'abandoned'] as const
const asStatus = (s: string | null) =>
  (STATUSES as readonly string[]).includes(s ?? '') ? (s as BookGroup['status']) : null

/**
 * One entry per title + authors: KOReader can record the same book under several md5
 * (a stale md5 cached in the sidecar, another file of the same book).
 */
export function groupBooks(rows: BookRow[]): BookGroup[] {
  const groups = new Map<string, BookRow[]>()
  for (const row of rows) {
    const k = groupKey(row)
    groups.set(k, [...(groups.get(k) ?? []), row])
  }

  return [...groups.values()]
    .map((members) => {
      members.sort((a, b) => activity(b) - activity(a))
      const primary = members[0]!
      const complete = members.some((m) => m.status === 'complete')
      const seconds = members.reduce((n, m) => n + Number(m.total_read_seconds), 0)
      const pageRatio =
        primary.last_page && primary.last_total_pages
          ? Math.min(primary.last_page / primary.last_total_pages, 1)
          : null
      const progress = complete
        ? 1
        : (primary.percent_finished ??
          pageRatio ??
          Math.max(0, ...members.map((m) => m.percent_finished ?? 0)))
      const lastRead = members
        .map((m) => (m.last_read_at ? new Date(m.last_read_at).getTime() : 0))
        .reduce((a, b) => Math.max(a, b), 0)
      const pick = <K extends keyof BookRow>(k: K) => members.find((m) => m[k] != null)?.[k] ?? null

      return {
        id: primary.id,
        ids: members.map((m) => m.id),
        md5: primary.md5,
        title: primary.title,
        authors: primary.authors,
        series: pick('series'),
        series_index: pick('series_index'),
        language: pick('language'),
        isbn: members.map((m) => parseIsbn(m.identifiers)).find(Boolean) ?? null,
        description: pick('description'),
        status: complete
          ? 'complete'
          : (asStatus(primary.status) ?? (seconds > 0 ? 'reading' : null)),
        status_modified: pick('status_modified'),
        rating: pick('rating'),
        review: pick('review'),
        progress: Math.min(Math.max(progress, 0), 1),
        total_read_seconds: seconds,
        pages_read: members.reduce((n, m) => n + Number(m.pages_read), 0),
        last_read_at: lastRead ? new Date(lastRead).toISOString() : null,
        highlights_count: members.reduce((n, m) => n + Number(m.highlights_count), 0),
        notes_count: members.reduce((n, m) => n + Number(m.notes_count), 0),
        _activity: activity(primary),
      }
    })
    .sort((a, b) => b._activity - a._activity || a.title.localeCompare(b.title))
    .map(({ _activity, ...group }) => group)
}
