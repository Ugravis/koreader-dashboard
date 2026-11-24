import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, eq, schema, sql } from '@koreader-dashboard/db'
import { bodyLimit } from 'hono/body-limit'
import { db } from '../db.ts'
import { resizeCover } from '../lib/covers.ts'
import { HttpError } from '../lib/errors.ts'
import { publish } from '../lib/events.ts'
import { errorResponse } from '../lib/openapi.ts'
import { requireDevice } from '../middleware/device.ts'
import type { AppEnv } from '../types.ts'

/** Raw cover file as stored in the book (EPUB covers are rarely above a few MB). */
export const MAX_COVER_BYTES = 8 * 1024 * 1024

const uploadCover = createRoute({
  method: 'put',
  path: '/{md5}',
  tags: ['library'],
  middleware: [
    requireDevice,
    bodyLimit({
      maxSize: MAX_COVER_BYTES,
      onError: () => {
        throw new HttpError(413, 'too_large', `Cover larger than ${MAX_COVER_BYTES} bytes`)
      },
    }),
  ] as const,
  request: {
    params: z.object({ md5: z.string().min(1).max(64) }),
    // The book file: files may share a md5 (sidecar copied from another book).
    query: z.object({ path: z.string().min(1).max(4096) }),
    body: {
      content: { 'application/octet-stream': { schema: z.string().openapi({ format: 'binary' }) } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ width: z.number().int(), height: z.number().int() }),
        },
      },
      description: 'Cover resized and stored for this file',
    },
    400: errorResponse('Not an image'),
    401: errorResponse('Missing or revoked device token'),
    404: errorResponse('No book for this md5 and path: send the library first'),
    413: errorResponse('Cover too large'),
  },
})

const { books, bookCovers } = schema

export const coverRoutes = new OpenAPIHono<AppEnv>().openapi(uploadCover, async (c) => {
  const { userId } = c.get('device')
  const { md5 } = c.req.valid('param')
  const { path: filePath } = c.req.valid('query')
  const [book] = await db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.md5, md5), eq(books.filePath, filePath)))
    .limit(1)
  if (!book) throw new HttpError(404, 'not_found', 'Unknown book')

  const cover = await resizeCover(Buffer.from(await c.req.arrayBuffer()))
  await db
    .insert(bookCovers)
    .values({ userId, md5, filePath, ...cover })
    .onConflictDoUpdate({
      target: [bookCovers.userId, bookCovers.md5, bookCovers.filePath],
      set: {
        image: sql`excluded.image`,
        width: sql`excluded.width`,
        height: sql`excluded.height`,
        updatedAt: sql`now()`,
      },
    })
  await publish(userId, { type: 'data' })
  return c.json({ width: cover.width, height: cover.height }, 200)
})
