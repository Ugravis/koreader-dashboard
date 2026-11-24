import { schema } from '@koreader-dashboard/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, pairDevice, request, resetDb, signUp } from './helpers.ts'

const payload = {
  books: [
    {
      md5: 'abc123',
      title: 'Dune',
      authors: 'Frank Herbert',
      series: 'Dune #1',
      language: 'en',
      pages: 600,
      notes: 2,
      highlights: 5,
      last_open: 1_764_000_000,
      total_read_time: 120,
      total_read_pages: 2,
    },
  ],
  page_stats: [
    { md5: 'abc123', page: 1, start_time: 1_764_000_000, duration: 60, total_pages: 600 },
    { md5: 'abc123', page: 2, start_time: 1_764_000_060, duration: 60, total_pages: 600 },
  ],
}

const ingest = (token: string, body: unknown) =>
  request('/v1/ingest', { body, headers: { authorization: `Bearer ${token}` } })

describe('ingest', () => {
  beforeEach(resetDb)

  it('is idempotent: same payload twice stores rows once', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)

    const first = await ingest(token, payload)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ accepted: 2, cursor: 1_764_000_060 })

    const second = await ingest(token, payload)
    expect(await second.json()).toEqual({ accepted: 0, cursor: 1_764_000_060 })

    expect(await db.select().from(schema.pageStats)).toHaveLength(2)
    const stored = await db.select().from(schema.books)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ highlights: 5, notes: 2, totalReadTime: 120 })

    const summary = await request('/v1/me/summary', { headers: { cookie } })
    expect(await summary.json()).toEqual({
      books_count: 1,
      total_read_seconds: 120,
      total_pages_read: 2,
    })
  })

  it('accepts page stats for a book sent earlier, rejects unknown md5', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    await ingest(token, { books: payload.books })

    const later = {
      md5: 'abc123',
      page: 3,
      start_time: 1_764_000_200,
      duration: 30,
      total_pages: 600,
    }
    expect(await (await ingest(token, { page_stats: [later] })).json()).toEqual({
      accepted: 1,
      cursor: 1_764_000_200,
    })

    const bad = await ingest(token, { page_stats: [{ ...later, md5: 'nope' }] })
    expect(bad.status).toBe(400)
    expect(await db.select().from(schema.pageStats)).toHaveLength(1)
  })

  it('enforces the device token and the batch limit', async () => {
    expect((await ingest('kdt_wrong', payload)).status).toBe(401)
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    const stats = Array.from({ length: 5001 }, (_, i) => ({ ...payload.page_stats[0]!, page: i }))
    const res = await ingest(token, { books: payload.books, page_stats: stats })
    expect(res.status).toBe(400)
  })

  it('lists books with progress, most recently read first', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    const other = { ...payload.books[0]!, md5: 'zzz999', title: 'Unread' }
    await ingest(token, { books: [...payload.books, other], page_stats: payload.page_stats })

    const res = await request('/v1/me/books', { headers: { cookie } })
    expect(res.status).toBe(200)
    const { books } = (await res.json()) as { books: Record<string, unknown>[] }
    expect(books.map((b) => b.title)).toEqual(['Dune', 'Unread'])
    expect(books[0]).toMatchObject({
      total_read_seconds: 120,
      last_page: 2,
      total_pages: 600,
      progress: 2 / 600,
      last_read_at: new Date(1_764_000_060 * 1000).toISOString(),
    })
    expect(books[1]).toMatchObject({ progress: 0, last_read_at: null, total_pages: 600 })
  })
})
