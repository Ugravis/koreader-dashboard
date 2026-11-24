import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { schema, sql } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { publish } from '../lib/events.ts'
import { HttpError } from '../lib/errors.ts'
import { errorResponse } from '../lib/openapi.ts'
import { requireDevice } from '../middleware/device.ts'
import type { AppEnv } from '../types.ts'

export const MAX_PAGE_STATS = 5000
export const MAX_BOOKS = 1000

const unixSeconds = z.number().int().nonnegative()
const count = z.number().int().nonnegative()

// One KOReader `book` row (statistics.sqlite3). Every column is kept. `ref` is a key chosen
// by the client (KOReader's local id) that page_stats use to reference the book in this request.
const IngestBook = z.object({
  ref: z.string().min(1).max(64),
  md5: z.string().min(1).max(64),
  title: z.string().max(1000),
  authors: z.string().max(1000).nullish(),
  series: z.string().max(1000).nullish(),
  language: z.string().max(50).nullish(),
  pages: count.nullish(),
  notes: count.nullish(),
  highlights: count.nullish(),
  last_open: unixSeconds.nullish(),
  total_read_time: count.nullish(),
  total_read_pages: count.nullish(),
})

// One KOReader `page_stat_data` row, with the book referenced by `ref`.
const IngestPageStat = z.object({
  book_ref: z.string().min(1).max(64),
  page: count,
  start_time: unixSeconds,
  duration: count,
  total_pages: count,
})

const IngestBody = z
  .object({
    books: z.array(IngestBook).max(MAX_BOOKS).default([]),
    page_stats: z.array(IngestPageStat).max(MAX_PAGE_STATS).default([]),
  })
  .openapi('IngestBody')

const IngestResponse = z
  .object({
    accepted: z.number().int().openapi({ description: 'Page stats newly stored' }),
    cursor: z
      .number()
      .int()
      .nullable()
      .openapi({ description: 'Max start_time (unix s) of the stored batch, null if empty' }),
  })
  .openapi('IngestResult')

const ingest = createRoute({
  method: 'post',
  path: '/',
  tags: ['ingest'],
  middleware: [requireDevice] as const,
  request: { body: { content: { 'application/json': { schema: IngestBody } } } },
  responses: {
    200: { content: { 'application/json': { schema: IngestResponse } }, description: 'Stored' },
    400: errorResponse('Invalid payload or unknown book_ref'),
    401: errorResponse('Missing or revoked device token'),
  },
})

const fromUnix = (s: number | null | undefined) => (s == null ? null : new Date(s * 1000))
const { books, pageStats } = schema

export const ingestRoutes = new OpenAPIHono<AppEnv>().openapi(ingest, async (c) => {
  const body = c.req.valid('json')
  const { userId } = c.get('device')

  const result = await db.transaction(async (tx) => {
    // ref -> books.id
    const ids = new Map<string, string>()

    if (body.books.length > 0) {
      // Same identity as KOReader (md5, title, authors): last occurrence wins.
      const key = (b: { md5: string; title: string; authors?: string | null }) =>
        JSON.stringify([b.md5, b.title, b.authors ?? null])
      const unique = [...new Map(body.books.map((b) => [key(b), b])).values()]
      const upserted = await tx
        .insert(books)
        .values(
          unique.map((b) => ({
            userId,
            md5: b.md5,
            title: b.title,
            authors: b.authors ?? null,
            series: b.series ?? null,
            language: b.language ?? null,
            pages: b.pages ?? null,
            notes: b.notes ?? null,
            highlights: b.highlights ?? null,
            lastOpen: fromUnix(b.last_open),
            totalReadTime: b.total_read_time ?? null,
            totalReadPages: b.total_read_pages ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: [books.userId, books.md5, books.title, books.authors],
          set: {
            series: sql`excluded.series`,
            language: sql`excluded.language`,
            pages: sql`excluded.pages`,
            notes: sql`excluded.notes`,
            highlights: sql`excluded.highlights`,
            lastOpen: sql`excluded.last_open`,
            totalReadTime: sql`excluded.total_read_time`,
            totalReadPages: sql`excluded.total_read_pages`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: books.id, md5: books.md5, title: books.title, authors: books.authors })
      const byKey = new Map(upserted.map((b) => [key(b), b.id]))
      for (const b of body.books) ids.set(b.ref, byKey.get(key(b))!)
    }

    if (body.page_stats.length === 0) return { accepted: 0, cursor: null }

    const unknown = [...new Set(body.page_stats.map((p) => p.book_ref))].filter((r) => !ids.has(r))
    if (unknown.length > 0) {
      throw new HttpError(400, 'unknown_book', `Unknown book_ref: ${unknown.join(', ')}`)
    }

    const inserted = await tx
      .insert(pageStats)
      .values(
        body.page_stats.map((p) => ({
          userId,
          bookId: ids.get(p.book_ref)!,
          page: p.page,
          startTime: new Date(p.start_time * 1000),
          duration: p.duration,
          totalPages: p.total_pages,
        })),
      )
      .onConflictDoNothing()
      .returning({ page: pageStats.page })

    return {
      accepted: inserted.length,
      cursor: Math.max(...body.page_stats.map((p) => p.start_time)),
    }
  })

  await publish(userId, { type: 'data' })
  return c.json(result, 200)
})
