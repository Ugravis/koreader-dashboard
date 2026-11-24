import { schema } from '@koreader-dashboard/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, pairDevice, request, resetDb, signUp } from './helpers.ts'

const post = (path: string, token: string, body: unknown) =>
  request(path, { body, headers: { authorization: `Bearer ${token}` } })

const sidecar = {
  md5: '6e7a',
  title: 'After, Tome 2',
  authors: 'Anna Todd',
  series: 'After #2',
  series_index: 2,
  language: 'fr',
  identifiers: 'uuid:urn:uuid:cddb\nisbn:978-2-7556-2063-4',
  file_path: '/mnt/us/documents/Books/After, Tome 2 - Anna Todd.epub',
  status: 'reading',
  status_modified: '2026-11-23',
  percent_finished: 0.2864,
  annotations: [
    {
      text: 'Un gros mensonge ?',
      chapter: '30 - Tessa',
      pageno: 254,
      datetime: '2026-11-24 08:36:21',
    },
    { text: 'Lorsque je sors', note: 'Bien vu', pageno: 233, datetime: '2026-11-24 00:52:56' },
  ],
}

describe('library', () => {
  beforeEach(resetDb)

  it('stores sidecar data, replaces annotations, merges same title + authors', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    // The same book under two md5, as recorded by KOReader.
    const stat = (ref: string, start: number) => ({
      book_ref: ref,
      page: 10,
      start_time: start,
      duration: 60,
      total_pages: 1030,
    })
    await post('/v1/ingest', token, {
      books: [
        { ref: '4', md5: 'c631', title: 'After, Tome 2', authors: 'Anna Todd', pages: 881 },
        { ref: '6', md5: '6e7a', title: 'After, Tome 2', authors: 'Anna Todd', pages: 1030 },
      ],
      page_stats: [stat('4', 1_764_000_000), stat('6', 1_764_100_000)],
    })

    const res = await post('/v1/library', token, { books: [sidecar] })
    expect(await res.json()).toEqual({ books: 1 })
    expect(await db.select().from(schema.annotations)).toHaveLength(2)

    // Snapshot: a removed highlight disappears.
    await post('/v1/library', token, {
      books: [{ ...sidecar, annotations: [sidecar.annotations[0]] }],
    })
    expect(await db.select().from(schema.annotations)).toHaveLength(1)

    const { books } = (await (await request('/v1/me/books', { headers: { cookie } })).json()) as {
      books: Record<string, unknown>[]
    }
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({
      title: 'After, Tome 2',
      status: 'reading',
      progress: 0.2864,
      total_read_seconds: 120,
      isbn: '9782755620634',
      highlights_count: 1,
    })
    expect(books[0]!.ids).toHaveLength(2)

    const detail = await request(`/v1/me/books/${books[0]!.id as string}`, { headers: { cookie } })
    const body = (await detail.json()) as { annotations: { text: string }[] }
    expect(body.annotations.map((a) => a.text)).toEqual(['Un gros mensonge ?'])
  })

  it('counts a book marked as read without reading sessions', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    await post('/v1/library', token, {
      books: [{ md5: 'aaa', title: 'Read long ago', authors: null, status: 'complete' }],
    })
    const summary = await request('/v1/me/summary', { headers: { cookie } })
    expect(await summary.json()).toMatchObject({ books_count: 1, finished_count: 1 })
    const { books } = (await (await request('/v1/me/books', { headers: { cookie } })).json()) as {
      books: Record<string, unknown>[]
    }
    expect(books[0]).toMatchObject({ status: 'complete', progress: 1, total_read_seconds: 0 })
  })

  it('rejects invalid status and requires a device token', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    const bad = await post('/v1/library', token, { books: [{ ...sidecar, status: 'finished' }] })
    expect(bad.status).toBe(400)
    expect((await post('/v1/library', 'kdt_wrong', { books: [] })).status).toBe(401)
  })
})
