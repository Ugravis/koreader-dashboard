import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, eq, inArray, schema } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { groupBooks, loadBookRows } from '../lib/books.ts'
import { HttpError } from '../lib/errors.ts'
import { errorResponse } from '../lib/openapi.ts'
import { requireSession } from '../middleware/session.ts'
import type { AppEnv } from '../types.ts'

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})

const MeSchema = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi('Me')

const SummarySchema = z
  .object({
    books_count: z.number().int(),
    finished_count: z.number().int(),
    total_read_seconds: z.number().int(),
    total_pages_read: z.number().int().openapi({ description: 'Distinct (book, page) read' }),
  })
  .openapi('Summary')

const BookSchema = z
  .object({
    id: z.uuid(),
    ids: z
      .array(z.uuid())
      .openapi({ description: 'Merged KOReader entries (same title + authors)' }),
    md5: z.string(),
    title: z.string(),
    authors: z.string().nullable(),
    series: z.string().nullable(),
    series_index: z.number().nullable(),
    language: z.string().nullable(),
    isbn: z.string().nullable(),
    description: z.string().nullable(),
    status: z.enum(['reading', 'complete', 'abandoned']).nullable(),
    status_modified: z.string().nullable(),
    rating: z.number().int().nullable(),
    review: z.string().nullable(),
    progress: z.number().min(0).max(1),
    total_read_seconds: z.number().int(),
    pages_read: z.number().int(),
    last_read_at: z.iso.datetime().nullable(),
    highlights_count: z.number().int(),
    notes_count: z.number().int(),
  })
  .openapi('Book')

const AnnotationSchema = z
  .object({
    id: z.uuid(),
    text: z.string().nullable(),
    note: z.string().nullable(),
    chapter: z.string().nullable(),
    pageno: z.number().int().nullable(),
    datetime: z.string().nullable(),
    color: z.string().nullable(),
  })
  .openapi('Annotation')

const getMe = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/',
  responses: { 200: json(MeSchema, 'Current user'), 401: errorResponse('Not signed in') },
})

const getBooks = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/books',
  responses: {
    200: json(z.object({ books: z.array(BookSchema) }), 'Books, most recently active first'),
    401: errorResponse('Not signed in'),
  },
})

const getBook = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/books/{id}',
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: json(
      z.object({ book: BookSchema, annotations: z.array(AnnotationSchema) }),
      'Book with its highlights and notes',
    ),
    401: errorResponse('Not signed in'),
    404: errorResponse('Unknown book'),
  },
})

const getSummary = createRoute({
  tags: ['me'],
  middleware: [requireSession] as const,
  method: 'get',
  path: '/summary',
  responses: { 200: json(SummarySchema, 'Totals'), 401: errorResponse('Not signed in') },
})

const { annotations } = schema

export const meRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getMe, (c) => {
    const { id, email, name } = c.get('user')
    return c.json({ id, email, name }, 200)
  })
  .openapi(getBooks, async (c) => {
    const books = groupBooks(await loadBookRows(db, c.get('user').id))
    return c.json({ books }, 200)
  })
  .openapi(getBook, async (c) => {
    const userId = c.get('user').id
    const id = c.req.valid('param').id
    const book = groupBooks(await loadBookRows(db, userId)).find((g) => g.ids.includes(id))
    if (!book) throw new HttpError(404, 'not_found', 'Unknown book')
    const rows = await db
      .select({
        id: annotations.id,
        text: annotations.text,
        note: annotations.note,
        chapter: annotations.chapter,
        pageno: annotations.pageno,
        datetime: annotations.datetime,
        color: annotations.color,
      })
      .from(annotations)
      .where(and(eq(annotations.userId, userId), inArray(annotations.bookId, book.ids)))
      .orderBy(annotations.pageno, annotations.datetime)
    return c.json({ book, annotations: rows }, 200)
  })
  .openapi(getSummary, async (c) => {
    const books = groupBooks(await loadBookRows(db, c.get('user').id))
    return c.json(
      {
        books_count: books.length,
        finished_count: books.filter((b) => b.status === 'complete').length,
        total_read_seconds: books.reduce((n, b) => n + b.total_read_seconds, 0),
        total_pages_read: books.reduce((n, b) => n + b.pages_read, 0),
      },
      200,
    )
  })
