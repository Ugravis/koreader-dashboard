import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq, schema } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { groupBooks, loadBookRows } from '../lib/books.ts'
import { HttpError } from '../lib/errors.ts'
import { loadActivity, loadAnnotations, loadBookStats } from '../lib/insights.ts'
import { errorResponse } from '../lib/openapi.ts'
import { safeTimeZone } from '../lib/stats.ts'
import { requireSession } from '../middleware/session.ts'
import type { AppEnv } from '../types.ts'
import { json, SessionSummarySchema } from './me.ts'

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const MAX_RANGE_DAYS = 400
const tzQuery = z
  .string()
  .max(64)
  .optional()
  .openapi({ description: 'IANA time zone, default UTC' })

const ActivitySchema = z
  .object({
    days: z.array(
      z.object({
        date: z.string(),
        seconds: z.number().int(),
        pages: z.number().int(),
        books: z.array(z.object({ id: z.uuid(), seconds: z.number().int() })),
      }),
    ),
  })
  .openapi('Activity')

const BookStatsSchema = z
  .object({
    timezone: z.string(),
    days: z.array(
      z.object({
        date: z.string(),
        seconds: z.number().int(),
        pages: z.number().int(),
        progress: z.number(),
      }),
    ),
    by_hour: z.array(z.number().int()),
    sessions: SessionSummarySchema,
    recent_sessions: z.array(
      z.object({ start: z.string(), seconds: z.number().int(), pages: z.number().int() }),
    ),
    first_read_at: z.string().nullable(),
    last_read_at: z.string().nullable(),
    pages_per_hour: z.number().nullable(),
    last_14_days_seconds: z.number().int(),
  })
  .openapi('BookStats')

const AnnotationEntrySchema = z
  .object({
    id: z.uuid(),
    book_id: z.uuid(),
    book_title: z.string(),
    book_authors: z.string().nullable(),
    text: z.string().nullable(),
    note: z.string().nullable(),
    chapter: z.string().nullable(),
    pageno: z.number().int().nullable(),
    datetime: z.string().nullable(),
    color: z.string().nullable(),
  })
  .openapi('AnnotationEntry')

const goal = z.number().int().min(1).max(100_000).nullable()
const GoalsSchema = z.object({ yearly_books: goal, daily_minutes: goal }).openapi('Goals')

const getActivity = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/activity',
  request: { query: z.object({ from: DAY, to: DAY, tz: tzQuery }) },
  responses: {
    200: json(ActivitySchema, 'Days with reading in the range, oldest first'),
    400: errorResponse('Invalid range'),
    401: errorResponse('Not signed in'),
  },
})

const getBookStats = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/books/{id}/stats',
  request: { params: z.object({ id: z.uuid() }), query: z.object({ tz: tzQuery }) },
  responses: {
    200: json(BookStatsSchema, 'Reading stats of one book'),
    401: errorResponse('Not signed in'),
    404: errorResponse('Unknown book'),
  },
})

const getAnnotations = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/annotations',
  responses: {
    200: json(z.object({ annotations: z.array(AnnotationEntrySchema) }), 'All highlights'),
    401: errorResponse('Not signed in'),
  },
})

const getGoals = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/goals',
  responses: { 200: json(GoalsSchema, 'Reading goals'), 401: errorResponse('Not signed in') },
})

const putGoals = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'put',
  path: '/goals',
  request: { body: { content: { 'application/json': { schema: GoalsSchema } }, required: true } },
  responses: { 200: json(GoalsSchema, 'Saved goals'), 401: errorResponse('Not signed in') },
})

const { readingGoals } = schema

export const insightRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getActivity, async (c) => {
    const { from, to, tz } = c.req.valid('query')
    const span = (Date.parse(to) - Date.parse(from)) / 86_400_000
    if (!(span >= 0 && span <= MAX_RANGE_DAYS))
      throw new HttpError(400, 'invalid_range', `from..to must span 0 to ${MAX_RANGE_DAYS} days`)
    const userId = c.get('user').id
    const groups = groupBooks(await loadBookRows(db, userId))
    const days = await loadActivity(db, userId, groups, safeTimeZone(tz), from, to)
    return c.json({ days }, 200)
  })
  .openapi(getBookStats, async (c) => {
    const userId = c.get('user').id
    const id = c.req.valid('param').id
    const book = groupBooks(await loadBookRows(db, userId)).find((g) => g.ids.includes(id))
    if (!book) throw new HttpError(404, 'not_found', 'Unknown book')
    const tz = safeTimeZone(c.req.valid('query').tz)
    return c.json(await loadBookStats(db, userId, book, tz), 200)
  })
  .openapi(getAnnotations, async (c) => {
    const userId = c.get('user').id
    const groups = groupBooks(await loadBookRows(db, userId))
    return c.json({ annotations: await loadAnnotations(db, userId, groups) }, 200)
  })
  .openapi(getGoals, async (c) => {
    const [row] = await db
      .select()
      .from(readingGoals)
      .where(eq(readingGoals.userId, c.get('user').id))
    return c.json(
      { yearly_books: row?.yearlyBooks ?? null, daily_minutes: row?.dailyMinutes ?? null },
      200,
    )
  })
  .openapi(putGoals, async (c) => {
    const body = c.req.valid('json')
    const values = { yearlyBooks: body.yearly_books, dailyMinutes: body.daily_minutes }
    await db
      .insert(readingGoals)
      .values({ userId: c.get('user').id, ...values })
      .onConflictDoUpdate({ target: readingGoals.userId, set: values })
    return c.json(body, 200)
  })
