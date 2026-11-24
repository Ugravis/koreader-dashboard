import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { inArray, schema, sql } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { HttpError } from '../lib/errors.ts'
import { errorResponse } from '../lib/openapi.ts'
import { requireDevice } from '../middleware/device.ts'
import type { AppEnv } from '../types.ts'

export const MAX_LIBRARY_BOOKS = 100
export const MAX_ANNOTATIONS = 4000

const str = (max: number) => z.string().max(max).nullish()
const count = z.number().int().nonnegative()
// KOReader stores annotation times as device local "YYYY-MM-DD HH:MM:SS".
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  .nullish()

// One entry of the sidecar `annotations` list (highlights, notes, bookmarks).
const Annotation = z.object({
  text: str(20_000),
  note: str(20_000),
  chapter: str(1000),
  pageno: count.nullish(),
  datetime: localDateTime,
  datetime_updated: localDateTime,
  color: str(50),
  drawer: str(50),
  pos0: str(2000),
  pos1: str(2000),
})

// Per-book sidecar data (metadata.<ext>.lua). Identity (md5, title, authors) as in KOReader.
const LibraryBook = z.object({
  md5: z.string().min(1).max(64),
  title: z.string().max(1000),
  authors: str(1000),
  series: str(1000),
  series_index: z.number().nonnegative().nullish(),
  language: str(50),
  keywords: str(5000),
  identifiers: str(5000),
  description: str(50_000),
  pages: count.nullish(),
  file_path: str(4000),
  status: z.enum(['reading', 'complete', 'abandoned']).nullish(),
  status_modified: z.iso.date().nullish(),
  percent_finished: z.number().min(0).max(1).nullish(),
  rating: z.number().int().min(0).max(5).nullish(),
  review: str(20_000),
  highlights: count.nullish(),
  notes: count.nullish(),
  annotations: z.array(Annotation).max(MAX_ANNOTATIONS).default([]),
})

const LibraryBody = z
  .object({ books: z.array(LibraryBook).max(MAX_LIBRARY_BOOKS) })
  .openapi('LibraryBody')

const syncLibrary = createRoute({
  method: 'post',
  path: '/',
  tags: ['library'],
  middleware: [requireDevice] as const,
  request: { body: { content: { 'application/json': { schema: LibraryBody } } } },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ books: z.number().int() }) } },
      description: 'Books upserted, annotations replaced for each book sent',
    },
    400: errorResponse('Invalid payload'),
    401: errorResponse('Missing or revoked device token'),
  },
})

const { books, annotations } = schema
const key = (b: { md5: string; title: string; authors?: string | null }) =>
  JSON.stringify([b.md5, b.title, b.authors ?? null])

export const libraryRoutes = new OpenAPIHono<AppEnv>().openapi(syncLibrary, async (c) => {
  const body = c.req.valid('json')
  const { userId } = c.get('device')
  const total = body.books.reduce((n, b) => n + b.annotations.length, 0)
  if (total > MAX_ANNOTATIONS) {
    throw new HttpError(400, 'too_many_annotations', `At most ${MAX_ANNOTATIONS} per request`)
  }
  if (body.books.length === 0) return c.json({ books: 0 }, 200)

  const unique = [...new Map(body.books.map((b) => [key(b), b])).values()]
  await db.transaction(async (tx) => {
    const upserted = await tx
      .insert(books)
      .values(
        unique.map((b) => ({
          userId,
          md5: b.md5,
          title: b.title,
          authors: b.authors ?? null,
          series: b.series ?? null,
          seriesIndex: b.series_index ?? null,
          language: b.language ?? null,
          keywords: b.keywords ?? null,
          identifiers: b.identifiers ?? null,
          description: b.description ?? null,
          pages: b.pages ?? null,
          filePath: b.file_path ?? null,
          status: b.status ?? null,
          statusModified: b.status_modified ?? null,
          percentFinished: b.percent_finished ?? null,
          rating: b.rating ?? null,
          review: b.review ?? null,
          highlights: b.highlights ?? null,
          notes: b.notes ?? null,
          libraryUpdatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [books.userId, books.md5, books.title, books.authors],
        // Sidecar fields only: reading totals stay owned by /v1/ingest.
        set: {
          series: sql`coalesce(excluded.series, ${books.series})`,
          seriesIndex: sql`excluded.series_index`,
          language: sql`coalesce(excluded.language, ${books.language})`,
          keywords: sql`excluded.keywords`,
          identifiers: sql`excluded.identifiers`,
          description: sql`excluded.description`,
          pages: sql`coalesce(excluded.pages, ${books.pages})`,
          filePath: sql`excluded.file_path`,
          status: sql`excluded.status`,
          statusModified: sql`excluded.status_modified`,
          percentFinished: sql`excluded.percent_finished`,
          rating: sql`excluded.rating`,
          review: sql`excluded.review`,
          highlights: sql`coalesce(excluded.highlights, ${books.highlights})`,
          notes: sql`coalesce(excluded.notes, ${books.notes})`,
          libraryUpdatedAt: sql`excluded.library_updated_at`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: books.id, md5: books.md5, title: books.title, authors: books.authors })

    // Annotations: the sidecar list is the source of truth, replace it per book.
    const idByKey = new Map(upserted.map((b) => [key(b), b.id]))
    await tx.delete(annotations).where(inArray(annotations.bookId, [...idByKey.values()]))
    const rows = unique.flatMap((b) =>
      b.annotations.map((a) => ({
        userId,
        bookId: idByKey.get(key(b))!,
        text: a.text ?? null,
        note: a.note ?? null,
        chapter: a.chapter ?? null,
        pageno: a.pageno ?? null,
        datetime: a.datetime ?? null,
        datetimeUpdated: a.datetime_updated ?? null,
        color: a.color ?? null,
        drawer: a.drawer ?? null,
        pos0: a.pos0 ?? null,
        pos1: a.pos1 ?? null,
      })),
    )
    if (rows.length > 0) await tx.insert(annotations).values(rows)
  })

  return c.json({ books: unique.length }, 200)
})
