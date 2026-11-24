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
