import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { count, eq, schema, sql } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { errorResponse } from '../lib/openapi.ts'
import { requireSession } from '../middleware/session.ts'
import type { AppEnv } from '../types.ts'

const MeSchema = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi('Me')

const SummarySchema = z
  .object({
    books_count: z.number().int(),
    total_read_seconds: z.number().int(),
    total_pages_read: z.number().int().openapi({ description: 'Distinct (book, page) read' }),
  })
  .openapi('Summary')

const BookSchema = z
  .object({
    id: z.uuid(),
    md5: z.string(),
    title: z.string(),
    authors: z.string().nullable(),
    series: z.string().nullable(),
    language: z.string().nullable(),
    total_read_seconds: z.number().int(),
    last_read_at: z.iso.datetime().nullable(),
    last_page: z.number().int().nullable(),
    total_pages: z.number().int().nullable(),
    progress: z.number().min(0).max(1).openapi({ description: 'Last page read / total pages' }),
  })
  .openapi('Book')

const getBooks = createRoute({
  method: 'get',
  path: '/books',
  tags: ['me'],
  middleware: [requireSession] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ books: z.array(BookSchema) }) } },
      description: 'Books, most recently read first',
    },
    401: errorResponse('Not signed in'),
  },
})

const getMe = createRoute({
  method: 'get',
  path: '/',
  tags: ['me'],
  middleware: [requireSession] as const,
  responses: {
    200: { content: { 'application/json': { schema: MeSchema } }, description: 'Current user' },
    401: errorResponse('Not signed in'),
  },
})

const getSummary = createRoute({
  method: 'get',
  path: '/summary',
  tags: ['me'],
  middleware: [requireSession] as const,
  responses: {
    200: { content: { 'application/json': { schema: SummarySchema } }, description: 'Totals' },
    401: errorResponse('Not signed in'),
  },
})

const { books, pageStats } = schema

export const meRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getMe, (c) => {
    const { id, email, name } = c.get('user')
    return c.json({ id, email, name }, 200)
  })
  .openapi(getBooks, async (c) => {
    const userId = c.get('user').id
    // Latest page_stats row per book gives the current position; totals from all rows.
    const rows = await db.execute<{
      id: string
      md5: string
      title: string
      authors: string | null
      series: string | null
      language: string | null
      total_read_seconds: string
      last_read_at: Date | null
      last_page: number | null
      total_pages: number | null
    }>(sql`
      SELECT b.id, b.md5, b.title, b.authors, b.series, b.language,
             coalesce(t.seconds, 0) AS total_read_seconds,
             l.start_time AS last_read_at, l.page AS last_page,
             coalesce(l.total_pages, b.pages) AS total_pages
      FROM ${books} b
      LEFT JOIN (
        SELECT book_id, sum(duration) AS seconds FROM ${pageStats}
        WHERE user_id = ${userId} GROUP BY book_id
      ) t ON t.book_id = b.id
      LEFT JOIN (
        SELECT DISTINCT ON (book_id) book_id, start_time, page, total_pages FROM ${pageStats}
        WHERE user_id = ${userId} ORDER BY book_id, start_time DESC
      ) l ON l.book_id = b.id
      WHERE b.user_id = ${userId}
      ORDER BY l.start_time DESC NULLS LAST, b.title
    `)
    return c.json(
      {
        books: rows.rows.map((r) => {
          const total = r.total_pages ?? 0
          const progress = total > 0 && r.last_page ? Math.min(r.last_page / total, 1) : 0
          return {
            id: r.id,
            md5: r.md5,
            title: r.title,
            authors: r.authors,
            series: r.series,
            language: r.language,
            total_read_seconds: Number(r.total_read_seconds),
            last_read_at: r.last_read_at ? new Date(r.last_read_at).toISOString() : null,
            last_page: r.last_page,
            total_pages: r.total_pages,
            progress,
          }
        }),
      },
      200,
    )
  })
  .openapi(getSummary, async (c) => {
    const userId = c.get('user').id
    const [[booksRow], [statsRow]] = await Promise.all([
      db.select({ n: count() }).from(books).where(eq(books.userId, userId)),
      db
        .select({
          seconds: sql<string>`coalesce(sum(${pageStats.duration}), 0)`,
          pages: sql<string>`count(distinct (${pageStats.bookId}, ${pageStats.page}))`,
        })
        .from(pageStats)
        .where(eq(pageStats.userId, userId)),
    ])
    return c.json(
      {
        books_count: booksRow?.n ?? 0,
        total_read_seconds: Number(statsRow?.seconds ?? 0),
        total_pages_read: Number(statsRow?.pages ?? 0),
      },
      200,
    )
  })
